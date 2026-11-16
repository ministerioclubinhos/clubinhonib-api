import { Injectable } from '@nestjs/common';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { IdeaDocumentRendererProvider } from '../providers/idea-document-renderer.provider';
import { IdeaEssenceGuardService } from './idea-essence-guard.service';
import { IdeaPdfRasterizerProvider } from '../providers/idea-pdf-rasterizer.provider';
import { IdeaImageTransformProvider } from '../providers/idea-image-transform.provider';
import { buildImagePdf, ImagePdfPage } from '../image-pdf.utils';
import { IdeaAiMediaResult, IdeaAiProcessContext } from '../types';
import {
  IdeaAiMediaStatus,
  IdeaAiSkipReason,
} from '../enums/ideas-section-ai.enums';
import { IDEA_AI, IDEA_AI_DOCUMENT_INSTRUCTIONS } from '../constants';
import { IDEA_DOCUMENT_SCHEMA } from '../schemas';
import { EnhancedIdeaDocumentDto } from '../dto/enhanced-idea.dto';
import {
  ideaDocumentText,
  checkIdeaDocumentStructure,
  checkIdeaPreservation,
  withAdminInstructions,
} from '../utils';
@Injectable()
export class EnhanceIdeaDocumentService {
  constructor(
    private readonly s3: AwsS3Service,
    private readonly gateway: IdeaAiGatewayProvider,
    private readonly renderer: IdeaDocumentRendererProvider,
    private readonly guard: IdeaEssenceGuardService,
    private readonly rasterizer: IdeaPdfRasterizerProvider,
    private readonly transform: IdeaImageTransformProvider,
  ) {}
  async enhance({
    settings,
    idea,
    source,
    instructions,
  }: IdeaAiProcessContext): Promise<IdeaAiMediaResult> {
    const skipped = (skipReason: IdeaAiSkipReason): IdeaAiMediaResult => ({
      sourceMediaId: source.id,
      status: IdeaAiMediaStatus.SKIPPED,
      skipReason,
    });
    if (!source.isLocalFile) return skipped(IdeaAiSkipReason.NOT_SUPPORTED);
    const prepared = idea.prepared.get(source.id);
    const pdf =
      prepared?.pdf ??
      (await this.renderer.toPdf(
        await this.s3.downloadOwned(source.url, IDEA_AI.maxFileBytes),
        source.originalName ?? source.url,
      ));
    const original = prepared
      ? {
          numpages: prepared.pages,
          text: prepared.text,
          images: prepared.images,
        }
      : await this.renderer.inspect(pdf);
    if (
      original.numpages > IDEA_AI.maxPages ||
      original.text.length > IDEA_AI.maxCharacters
    )
      return skipped(IdeaAiSkipReason.TOO_LARGE);
    const hasText = Boolean(original.text.trim());
    // PDF visual (sem texto, ou com imagens de conteúdo): reescrever só o texto
    // perderia as imagens. Nitidez e níveis, sem IA, mantêm tudo no lugar.
    // numpages 0 = o leitor não conseguiu abrir o PDF, então ele fica como está.
    if (!hasText || original.images > 0)
      return original.numpages > 0
        ? this.enhanceScan(source.id, pdf, original.numpages)
        : skipped(IdeaAiSkipReason.ESSENTIAL_VISUALS);
    const attachment = {
      data: pdf,
      name: 'original.pdf',
      mimeType: 'application/pdf',
    };
    const result = await this.gateway.json(
      settings,
      {
        schema: IDEA_DOCUMENT_SCHEMA,
        attachments: [attachment],
        instructions: withAdminInstructions(
          IDEA_AI_DOCUMENT_INSTRUCTIONS,
          instructions,
        ),
        data: {
          extractedText: original.text,
          idea: { title: idea.title, description: idea.description },
        },
      },
      EnhancedIdeaDocumentDto,
    );
    if (result.hasEssentialVisuals)
      return skipped(IdeaAiSkipReason.ESSENTIAL_VISUALS);
    const text = ideaDocumentText(result);
    if (text.length > IDEA_AI.maxCharacters)
      return skipped(IdeaAiSkipReason.TOO_LARGE);
    const structure = checkIdeaDocumentStructure(original.text, result);
    const drift = checkIdeaPreservation(
      original.text,
      text,
      IDEA_AI.minTextPreservation,
    );
    if (drift) structure.violations.push(drift);
    structure.approved = !structure.violations.length;
    if (!structure.approved)
      return {
        sourceMediaId: source.id,
        status: IdeaAiMediaStatus.REJECTED_BY_GUARD,
        guard: structure,
      };
    const guard = await this.guard.verify(settings, original.text, text, [
      attachment,
    ]);
    if (!guard.approved)
      return {
        sourceMediaId: source.id,
        status: IdeaAiMediaStatus.REJECTED_BY_GUARD,
        guard,
      };
    const rendered = await this.renderer.render(result);
    return {
      sourceMediaId: source.id,
      status: IdeaAiMediaStatus.ENHANCED,
      guard,
      artifact: rendered.artifact,
      editable: rendered.editable,
      editableDocument: rendered.document,
    };
  }

  /**
   * PDF visual (só imagem, ou texto com imagens): cada página é rasterizada, recebe o mesmo ajuste
   * determinístico das fotos (níveis e nitidez, sem IA e sem tokens) e o PDF
   * é remontado. O desenho fica idêntico, só mais nítido; qualquer mudança de
   * proporção ou de conteúdo reprova a página e o original é mantido.
   */
  private async enhanceScan(
    sourceMediaId: string,
    pdf: Buffer,
    pages: number,
  ): Promise<IdeaAiMediaResult> {
    const keep = (): IdeaAiMediaResult => ({
      sourceMediaId,
      status: IdeaAiMediaStatus.SKIPPED,
      skipReason: IdeaAiSkipReason.ESSENTIAL_VISUALS,
    });
    const originals = await this.rasterizer.toPngPages(
      pdf,
      Math.min(pages, IDEA_AI.maxImages),
    );
    if (!originals?.length || pages > IDEA_AI.maxImages) return keep();
    const violations: string[] = [];
    const cleaned: ImagePdfPage[] = [];
    for (const [index, original] of originals.entries()) {
      const enhanced = await this.transform.deterministic(original);
      const verdict = await this.transform.compare(original, enhanced);
      violations.push(
        ...verdict.violations.map((v) => `Página ${index + 1}: ${v}`),
      );
      const jpeg = await this.transform.toJpeg(
        enhanced,
        IDEA_AI.scanJpegQuality,
      );
      cleaned.push(jpeg);
    }
    const guard = { approved: !violations.length, violations };
    if (!guard.approved)
      return {
        sourceMediaId,
        status: IdeaAiMediaStatus.REJECTED_BY_GUARD,
        guard,
      };
    return {
      sourceMediaId,
      status: IdeaAiMediaStatus.ENHANCED,
      guard,
      artifact: {
        buffer: buildImagePdf(cleaned, IDEA_AI.scanDpi),
        name: 'ideia-melhorada.pdf',
        mimeType: 'application/pdf',
      },
    };
  }
}
