import { Injectable } from '@nestjs/common';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { IdeaDocumentRendererProvider } from '../providers/idea-document-renderer.provider';
import { IdeaEssenceGuardService } from './idea-essence-guard.service';
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
  ) {}
  async enhance({
    settings,
    source,
    instructions,
  }: IdeaAiProcessContext): Promise<IdeaAiMediaResult> {
    const skipped = (skipReason: IdeaAiSkipReason): IdeaAiMediaResult => ({
      sourceMediaId: source.id,
      status: IdeaAiMediaStatus.SKIPPED,
      skipReason,
    });
    if (!source.isLocalFile) return skipped(IdeaAiSkipReason.NOT_SUPPORTED);
    const bytes = await this.s3.downloadOwned(source.url, IDEA_AI.maxFileBytes);
    const pdf = await this.renderer.toPdf(
      bytes,
      source.originalName ?? source.url,
    );
    const original = await this.renderer.inspect(pdf);
    if (
      original.numpages > IDEA_AI.maxPages ||
      original.text.length > IDEA_AI.maxCharacters
    )
      return skipped(IdeaAiSkipReason.TOO_LARGE);
    // No trustworthy extracted text: a scanned drawing/template must stay intact.
    if (!original.text.trim())
      return skipped(IdeaAiSkipReason.ESSENTIAL_VISUALS);
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
        data: { extractedText: original.text },
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
    return {
      sourceMediaId: source.id,
      status: IdeaAiMediaStatus.ENHANCED,
      guard,
      ...(await this.renderer.render(result)),
    };
  }
}
