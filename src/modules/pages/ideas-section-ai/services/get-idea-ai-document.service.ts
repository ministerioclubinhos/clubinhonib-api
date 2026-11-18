import { Injectable } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IDEA_AI } from '../constants';
import type { IdeaAiDocumentDto } from '../dto/idea-ai-response.dto';
import {
  IdeaAiDocumentSource,
  IdeaAiMediaKind,
  IdeaAiMediaStatus,
} from '../enums/ideas-section-ai.enums';
import { ideaTextToTiptap } from '../idea-document.utils';
import { IdeaDocumentRendererProvider } from '../providers/idea-document-renderer.provider';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';

/** Abre, no editor, o documento que a IA melhorou. */
@Injectable()
export class GetIdeaAiDocumentService {
  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly s3: AwsS3Service,
    private readonly renderer: IdeaDocumentRendererProvider,
  ) {}

  async get(
    sectionId: string,
    sourceMediaId: string,
  ): Promise<IdeaAiDocumentDto> {
    const attempt = await this.repo.currentAttempt(sectionId);
    const result = attempt
      ? await this.repo.mediaResult(attempt.id, sourceMediaId)
      : null;
    if (
      !attempt ||
      !result ||
      result.kind !== IdeaAiMediaKind.DOCUMENT ||
      result.status !== IdeaAiMediaStatus.ENHANCED ||
      !result.enhancedMedia
    )
      throw new AppNotFoundException(
        ErrorCode.IDEA_AI_DOCUMENT_UNAVAILABLE,
        'Este documento não tem uma versão melhorada para editar.',
      );
    const editedAt = result.documentEditedAt
      ? result.documentEditedAt.toISOString()
      : null;
    if (result.editableDocumentJson)
      return {
        enhancementId: attempt.id,
        sourceMediaId,
        document: result.editableDocumentJson,
        source: IdeaAiDocumentSource.STORED,
        editedAt,
      };
    // Resultado de antes da edição manual: o conteúdo sai do PDF melhorado.
    const pdf = await this.s3.downloadOwned(
      result.enhancedMedia.url,
      IDEA_AI.maxFileBytes,
    );
    const { text } = await this.renderer.inspect(pdf);
    return {
      enhancementId: attempt.id,
      sourceMediaId,
      document: ideaTextToTiptap(text),
      source: IdeaAiDocumentSource.EXTRACTED,
      editedAt,
    };
  }
}
