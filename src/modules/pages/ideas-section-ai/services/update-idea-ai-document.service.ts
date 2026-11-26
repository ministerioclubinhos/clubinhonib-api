import { Injectable, Logger } from '@nestjs/common';
import {
  AppValidationException,
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IDEA_AI_ACTIVE } from '../constants';
import type { IdeaAiDocumentDto } from '../dto/idea-ai-response.dto';
import type { SaveIdeaAiDocumentDto } from '../dto/save-idea-ai-document.dto';
import {
  IdeaAiDocumentSource,
  IdeaAiMediaKind,
  IdeaAiMediaStatus,
} from '../enums/ideas-section-ai.enums';
import { validateIdeaTiptapDocument } from '../idea-document.utils';
import { IdeaDocumentRendererProvider } from '../providers/idea-document-renderer.provider';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { ideaArtifactFile } from '../utils';

/**
 * Salva o documento melhorado editado à mão: gera DOCX e PDF novos a partir do
 * conteúdo do editor e troca os arquivos do resultado.
 *
 * Cuidado com o S3: os arquivos novos sobem antes da transação (e são
 * descartados se ela falhar); os antigos só saem do bucket depois do commit e
 * só se nenhum outro resultado (tentativa reaproveitada) ainda os usar.
 */
@Injectable()
export class UpdateIdeaAiDocumentService {
  private readonly logger = new Logger(UpdateIdeaAiDocumentService.name);

  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly renderer: IdeaDocumentRendererProvider,
    private readonly media: MediaItemProcessor,
    private readonly s3: AwsS3Service,
  ) {}

  async save(
    sectionId: string,
    sourceMediaId: string,
    body: SaveIdeaAiDocumentDto,
  ): Promise<IdeaAiDocumentDto> {
    const problem = validateIdeaTiptapDocument(body.document);
    if (problem)
      throw new AppValidationException(
        ErrorCode.IDEA_AI_DOCUMENT_INVALID,
        problem,
      );

    // Falha cedo, antes de gastar uma conversão do LibreOffice à toa.
    await this.assertEditable(sectionId, sourceMediaId, body.enhancementId);

    const rendered = await this.renderer.renderTiptap(body.document);
    const uploads = new S3UploadTracker((file) => this.s3.upload(file));
    const editedAt = new Date();
    let obsoleteUrls: string[] = [];
    try {
      const pdfUrl = await uploads.upload(ideaArtifactFile(rendered.artifact));
      const docxUrl = await uploads.upload(ideaArtifactFile(rendered.editable));

      obsoleteUrls = await this.repo.transaction(async (manager) => {
        const section = await this.repo.lockSection(sectionId, manager);
        if (!section) throw this.notFound();
        if (section.page)
          throw new AppConflictException(
            ErrorCode.IDEA_AI_ALREADY_PUBLISHED,
            'Esta ideia já foi publicada.',
          );
        const history = await this.repo.attempts([sectionId], manager);
        if (history.some((a) => IDEA_AI_ACTIVE.includes(a.status)))
          throw new AppConflictException(
            ErrorCode.IDEA_AI_ENHANCEMENT_IN_PROGRESS,
            'Aguarde a melhoria em andamento ou cancele-a antes de editar o documento.',
          );
        const current = await this.repo.currentAttempt(sectionId, manager);
        if (!current || current.id !== body.enhancementId)
          throw new AppConflictException(
            ErrorCode.IDEA_AI_STALE_DECISIONS,
            'O resultado da IA mudou. Reabra o documento para editar a versão atual.',
          );
        const result = await this.repo.mediaResult(
          current.id,
          sourceMediaId,
          manager,
        );
        if (!result || !this.isEditable(result)) throw this.unavailable();

        const create = (
          mediaType: MediaType,
          url: string,
          name: string,
          size: number,
        ) =>
          this.media.saveMediaItemInTransaction(manager, {
            title: result.sourceMedia.title,
            description: '',
            mediaType,
            uploadType: UploadType.UPLOAD,
            isLocalFile: true,
            url,
            originalName: name,
            size,
            targetId: sectionId,
            targetType: MediaTargetType.IdeasSectionAiEnhancedMedia,
          });
        const pdf = await create(
          MediaType.DOCUMENT,
          pdfUrl,
          rendered.artifact.name,
          rendered.artifact.buffer.length,
        );
        const docx = await create(
          MediaType.DOCUMENT,
          docxUrl,
          rendered.editable.name,
          rendered.editable.buffer.length,
        );
        await this.repo.updateMediaResult(
          result.id,
          {
            enhancedMediaId: pdf.id,
            editableMediaId: docx.id,
            editableDocumentJson: body.document,
            documentEditedAt: editedAt,
          },
          manager,
        );

        // Arquivos antigos: só saem se nenhuma outra tentativa os reaproveita.
        const obsolete: string[] = [];
        for (const old of [result.enhancedMedia, result.editableMedia]) {
          if (!old) continue;
          if ((await this.repo.mediaReferences(old.id, result.id, manager)) > 0)
            continue;
          await this.media.deleteMediaItemByIdInTransaction(manager, old.id);
          if (old.isLocalFile) obsolete.push(old.url);
        }
        return obsolete;
      });
    } catch (error: unknown) {
      // Nada referenciou os arquivos novos: não podem ficar órfãos no bucket.
      await this.media.discardUnreferencedUploads(uploads.uploadedUrls, (url) =>
        this.s3.delete(url),
      );
      throw error;
    }

    // Depois do commit: apaga do S3 só o que nenhuma mídia referencia mais.
    await this.media.discardUnreferencedUploads(obsoleteUrls, (url) =>
      this.s3.delete(url),
    );
    this.logger.log(
      `Documento ${sourceMediaId} da ideia ${sectionId} editado à mão e regenerado.`,
    );
    return {
      enhancementId: body.enhancementId,
      sourceMediaId,
      document: body.document,
      source: IdeaAiDocumentSource.STORED,
      editedAt: editedAt.toISOString(),
    };
  }

  private async assertEditable(
    sectionId: string,
    sourceMediaId: string,
    enhancementId: string,
  ): Promise<void> {
    const current = await this.repo.currentAttempt(sectionId);
    if (!current) throw this.unavailable();
    if (current.id !== enhancementId)
      throw new AppConflictException(
        ErrorCode.IDEA_AI_STALE_DECISIONS,
        'O resultado da IA mudou. Reabra o documento para editar a versão atual.',
      );
    const result = await this.repo.mediaResult(current.id, sourceMediaId);
    if (!result || !this.isEditable(result)) throw this.unavailable();
  }

  private isEditable(result: {
    kind: IdeaAiMediaKind;
    status: IdeaAiMediaStatus;
    enhancedMedia: unknown;
  }): boolean {
    return (
      result.kind === IdeaAiMediaKind.DOCUMENT &&
      result.status === IdeaAiMediaStatus.ENHANCED &&
      Boolean(result.enhancedMedia)
    );
  }

  private unavailable(): AppNotFoundException {
    return new AppNotFoundException(
      ErrorCode.IDEA_AI_DOCUMENT_UNAVAILABLE,
      'Este documento não tem uma versão melhorada para editar.',
    );
  }

  private notFound(): AppNotFoundException {
    return new AppNotFoundException(
      ErrorCode.IDEA_NOT_FOUND,
      'Ideia não encontrada.',
    );
  }
}
