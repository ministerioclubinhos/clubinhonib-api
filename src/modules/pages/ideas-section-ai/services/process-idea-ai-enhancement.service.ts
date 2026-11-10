import { Injectable } from '@nestjs/common';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { LessonLlmProvider } from 'src/modules/ai-lessons/providers/lesson-llm.types';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { IdeasSectionAiEnhancementEntity } from '../entities/ideas-section-ai-enhancement.entity';
import { EnhanceIdeaTextService } from './enhance-idea-text.service';
import { EnhanceIdeaDocumentService } from './enhance-idea-document.service';
import { EnhanceIdeaImageService } from './enhance-idea-image.service';
import {
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
  IdeaAiMediaKind,
  IdeaAiMediaStatus,
  IdeaAiSkipReason,
} from '../enums/ideas-section-ai.enums';
import {
  IdeaAiMediaResult,
  IdeaAiTextResult,
  StagedIdeaAiMedia,
} from '../types';
import { ideaArtifactFile } from '../utils';
@Injectable()
export class ProcessIdeaAiEnhancementService {
  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly settingsService: GetAiProviderSettingsService,
    private readonly text: EnhanceIdeaTextService,
    private readonly documents: EnhanceIdeaDocumentService,
    private readonly images: EnhanceIdeaImageService,
    private readonly media: MediaItemProcessor,
    private readonly s3: AwsS3Service,
  ) {}
  async process(
    attempt: IdeasSectionAiEnhancementEntity,
    owner: string,
  ): Promise<void> {
    const uploads = new S3UploadTracker((file) => this.s3.upload(file));
    try {
      const snapshot = await this.repo.snapshot(attempt.sectionId);
      if (!snapshot) return;
      const settings = await this.settingsService.getInternalSettings();
      if (
        attempt.provider !== String(LessonLlmProvider.OPENAI) &&
        attempt.provider !== String(LessonLlmProvider.GEMINI)
      )
        throw new Error(IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED);
      settings.llmProvider =
        attempt.provider === String(LessonLlmProvider.OPENAI)
          ? LessonLlmProvider.OPENAI
          : LessonLlmProvider.GEMINI;
      settings[settings.llmProvider].generalModel = attempt.textModel ?? '';
      settings[settings.llmProvider].imageModel = attempt.imageModel ?? '';
      if (!settings[settings.llmProvider].apiKey)
        throw new Error(IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED);
      let text: IdeaAiTextResult;
      let errorCode: IdeaAiErrorCode | null = null;
      try {
        text = await this.text.enhance(
          settings,
          snapshot.submittedTitle,
          snapshot.submittedDescription,
        );
      } catch {
        text = {
          title: null,
          description: null,
          guard: {
            approved: false,
            violations: ['Não foi possível melhorar o texto nesta tentativa.'],
          },
        };
        errorCode = IdeaAiErrorCode.PROVIDER_REQUEST_FAILED;
      }
      const results: IdeaAiMediaResult[] = [];
      let imageIndex = 0;
      for (const item of snapshot.medias.sort(
        (a, b) => a.position - b.position,
      )) {
        if (!(await this.repo.renew(attempt.id, owner))) return;
        const source = item.sourceMedia;
        try {
          const context = { source, settings, imageIndex };
          if (source.mediaType === MediaType.IMAGE) {
            imageIndex++;
            results.push(await this.images.enhance(context));
          } else if (source.mediaType === MediaType.DOCUMENT)
            results.push(await this.documents.enhance(context));
          else
            results.push({
              sourceMediaId: source.id,
              status: IdeaAiMediaStatus.SKIPPED,
              skipReason: IdeaAiSkipReason.NOT_SUPPORTED,
            });
        } catch {
          results.push({
            sourceMediaId: source.id,
            status: IdeaAiMediaStatus.FAILED,
          });
        }
      }
      const staged: StagedIdeaAiMedia[] = [];
      for (const result of results) {
        if (!(await this.repo.renew(attempt.id, owner))) return;
        staged.push({
          result,
          url: result.artifact
            ? await uploads.upload(ideaArtifactFile(result.artifact))
            : null,
          editableUrl: result.editable
            ? await uploads.upload(ideaArtifactFile(result.editable))
            : null,
        });
      }
      await this.repo.transaction(async (manager) => {
        if (!(await this.repo.lockSection(attempt.sectionId, manager))) return;
        if (!(await this.repo.owned(attempt.id, owner, manager))) return;
        const anySuccess =
          text.guard.approved ||
          results.some((r) => r.status === IdeaAiMediaStatus.ENHANCED);
        const allSuccess =
          text.guard.approved &&
          results.every(
            (r) =>
              r.status === IdeaAiMediaStatus.ENHANCED ||
              (r.status === IdeaAiMediaStatus.SKIPPED &&
                r.skipReason === IdeaAiSkipReason.NOT_SUPPORTED),
          );
        const status = anySuccess
          ? allSuccess
            ? IdeaAiEnhancementStatus.COMPLETED
            : IdeaAiEnhancementStatus.PARTIAL
          : IdeaAiEnhancementStatus.FAILED;
        for (const { result, url, editableUrl } of staged) {
          const source = snapshot.medias.find(
            (m) => m.sourceMediaId === result.sourceMediaId,
          )!.sourceMedia;
          const kind =
            source.mediaType === MediaType.IMAGE
              ? IdeaAiMediaKind.IMAGE
              : source.mediaType === MediaType.DOCUMENT
                ? IdeaAiMediaKind.DOCUMENT
                : IdeaAiMediaKind.VIDEO;
          const saved =
            url && result.artifact
              ? await this.media.saveMediaItemInTransaction(manager, {
                  title: source.title,
                  description: '',
                  mediaType: source.mediaType,
                  uploadType: UploadType.UPLOAD,
                  isLocalFile: true,
                  url,
                  originalName: result.artifact.name,
                  size: result.artifact.buffer.length,
                  targetId: attempt.sectionId,
                  targetType: MediaTargetType.IdeasSectionAiEnhancedMedia,
                })
              : null;
          const editable =
            editableUrl && result.editable
              ? await this.media.saveMediaItemInTransaction(manager, {
                  title: source.title,
                  description: '',
                  mediaType: MediaType.DOCUMENT,
                  uploadType: UploadType.UPLOAD,
                  isLocalFile: true,
                  url: editableUrl,
                  originalName: result.editable.name,
                  size: result.editable.buffer.length,
                  targetId: attempt.sectionId,
                  targetType: MediaTargetType.IdeasSectionAiEnhancedMedia,
                })
              : null;
          await this.repo.saveMediaResult(
            {
              enhancementId: attempt.id,
              sourceMediaId: source.id,
              kind,
              status: result.status,
              skipReason: result.skipReason ?? null,
              enhancedMediaId: saved?.id ?? null,
              editableMediaId: editable?.id ?? null,
              guard: result.guard ? { ...result.guard } : null,
            },
            manager,
          );
        }
        if (anySuccess)
          await this.repo.clearCurrent(attempt.sectionId, manager);
        await this.repo.saveAttempt(
          {
            id: attempt.id,
            status,
            enhancedTitle: text.title,
            enhancedDescription: text.description,
            textGuard: { ...text.guard },
            currentResultSectionId: anySuccess ? attempt.sectionId : null,
            errorCode: anySuccess
              ? null
              : (errorCode ?? IdeaAiErrorCode.GUARD_REJECTED),
            activeSectionId: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            finishedAt: new Date(),
          },
          manager,
        );
      });
    } catch (error: unknown) {
      await this.repo.transaction(async (manager) => {
        if (
          !(await this.repo.lockSection(attempt.sectionId, manager)) ||
          !(await this.repo.owned(attempt.id, owner, manager))
        )
          return;
        const code =
          error instanceof Error &&
          error.message === String(IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED)
            ? IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED
            : IdeaAiErrorCode.PROVIDER_REQUEST_FAILED;
        await this.repo.saveAttempt(
          {
            id: attempt.id,
            status: IdeaAiEnhancementStatus.FAILED,
            errorCode: code,
            activeSectionId: null,
            leaseOwner: null,
            leaseExpiresAt: null,
            finishedAt: new Date(),
          },
          manager,
        );
      });
    } finally {
      // Includes cancellation, deletion, lost leases and rollback. Referenced artifacts survive.
      await this.media.discardUnreferencedUploads(uploads.uploadedUrls, (url) =>
        this.s3.delete(url),
      );
    }
  }
}
