import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { LessonLlmProvider } from 'src/modules/ai-lessons/providers/lesson-llm.types';
import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { IdeasSectionAiEnhancementEntity } from '../entities/ideas-section-ai-enhancement.entity';
import { IdeasSectionAiMediaEnhancementEntity } from '../entities/ideas-section-ai-media-enhancement.entity';
import { IdeasSectionSubmissionSnapshotEntity } from '../entities/ideas-section-submission-snapshot.entity';
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
import { IDEA_AI_ABORTING_ERRORS } from '../constants';
import {
  IdeaAiMediaResult,
  IdeaAiTextResult,
  StagedIdeaAiMedia,
} from '../types';
import { ideaAiErrorCodeFrom, ideaArtifactFile, isIdeaAiVideo } from '../utils';
import { IdeaAiAbort } from '../errors';

@Injectable()
export class ProcessIdeaAiEnhancementService {
  private readonly logger = new Logger(ProcessIdeaAiEnhancementService.name);

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
    const started = Date.now();
    const uploads = new S3UploadTracker((file) => this.s3.upload(file));
    try {
      const snapshot = await this.repo.snapshot(attempt.sectionId);
      if (!snapshot) throw new IdeaAiAbort(IdeaAiErrorCode.SNAPSHOT_MISSING);
      const settings = await this.providerSettings(attempt);
      const targeted = snapshot.medias
        .filter(
          (m) =>
            attempt.targetMediaIds === null ||
            attempt.targetMediaIds.includes(m.sourceMediaId),
        )
        .sort((a, b) => a.position - b.position);
      // Vídeo (upload ou link) nunca passa pela IA: é pulado aqui, sem
      // download, sem chamada ao provedor e sem contar no progresso.
      const enhanceable = targeted.filter((m) => !isIdeaAiVideo(m.sourceMedia));
      const progress = {
        done: 0,
        total: (attempt.includeText ? 1 : 0) + enhanceable.length,
      };
      if (!(await this.repo.renew(attempt.id, owner, { ...progress }))) return;

      let text: IdeaAiTextResult | null = null;
      let textError: IdeaAiErrorCode | null = null;
      if (attempt.includeText) {
        try {
          text = await this.text.enhance(
            settings,
            snapshot.submittedTitle,
            snapshot.submittedDescription,
            attempt.instructions,
          );
        } catch (error: unknown) {
          textError = this.itemError(error);
          text = {
            title: null,
            description: null,
            guard: {
              approved: false,
              violations: [
                'Não foi possível melhorar o texto nesta tentativa.',
              ],
            },
          };
        }
        progress.done++;
        if (!(await this.repo.renew(attempt.id, owner, { ...progress })))
          return;
      }

      const results: IdeaAiMediaResult[] = targeted
        .filter((m) => isIdeaAiVideo(m.sourceMedia))
        .map((m) => ({
          sourceMediaId: m.sourceMediaId,
          status: IdeaAiMediaStatus.SKIPPED,
          skipReason: IdeaAiSkipReason.NOT_SUPPORTED,
        }));
      let imageIndex = 0;
      for (const item of enhanceable) {
        const source = item.sourceMedia;
        try {
          const context = {
            source,
            settings,
            imageIndex,
            instructions: attempt.instructions,
          };
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
        } catch (error: unknown) {
          results.push({
            sourceMediaId: source.id,
            status: IdeaAiMediaStatus.FAILED,
            errorCode: this.itemError(error),
          });
        }
        progress.done++;
        if (!(await this.repo.renew(attempt.id, owner, { ...progress })))
          return;
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
        await this.commit(
          attempt,
          snapshot,
          text,
          textError,
          staged,
          manager,
          started,
        );
      });
    } catch (error: unknown) {
      const code =
        error instanceof IdeaAiAbort ? error.code : ideaAiErrorCodeFrom(error);
      this.logger.warn(
        `Melhoria ${attempt.id} da ideia ${attempt.sectionId} falhou (${code}) após ${Date.now() - started} ms.`,
      );
      await this.repo.transaction(async (manager) => {
        if (
          !(await this.repo.lockSection(attempt.sectionId, manager)) ||
          !(await this.repo.owned(attempt.id, owner, manager))
        )
          return;
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

  private async providerSettings(
    attempt: IdeasSectionAiEnhancementEntity,
  ): Promise<InternalAiProviderSettings> {
    const settings = await this.settingsService.getInternalSettings();
    if (
      attempt.provider !== String(LessonLlmProvider.OPENAI) &&
      attempt.provider !== String(LessonLlmProvider.GEMINI)
    )
      throw new IdeaAiAbort(IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED);
    settings.llmProvider =
      attempt.provider === String(LessonLlmProvider.OPENAI)
        ? LessonLlmProvider.OPENAI
        : LessonLlmProvider.GEMINI;
    settings[settings.llmProvider].generalModel = attempt.textModel ?? '';
    settings[settings.llmProvider].imageModel = attempt.imageModel ?? '';
    if (!settings[settings.llmProvider].apiKey)
      throw new IdeaAiAbort(IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED);
    return settings;
  }

  /** Infra failures abort everything; anything else fails only the item. */
  private itemError(error: unknown): IdeaAiErrorCode {
    const code = ideaAiErrorCodeFrom(error);
    if (IDEA_AI_ABORTING_ERRORS.includes(code)) throw new IdeaAiAbort(code);
    return code;
  }

  /**
   * Persists the attempt. Items outside the scope are carried over from the
   * base result; a targeted item that fails keeps the base's approved version
   * (flagged with the new error). A partial attempt becomes the current
   * result only if something it redid succeeded.
   */
  private async commit(
    attempt: IdeasSectionAiEnhancementEntity,
    snapshot: IdeasSectionSubmissionSnapshotEntity,
    text: IdeaAiTextResult | null,
    textError: IdeaAiErrorCode | null,
    staged: StagedIdeaAiMedia[],
    manager: EntityManager,
    started: number,
  ): Promise<void> {
    const base = attempt.baseEnhancementId
      ? await this.repo.findAttempt(attempt.baseEnhancementId, manager)
      : null;
    const baseResults = base
      ? await this.repo.mediaResults([base.id], manager)
      : [];
    const textSuccess = Boolean(text && (text.title || text.description));
    const mediaSuccess = staged.some(
      (s) => s.result.status === IdeaAiMediaStatus.ENHANCED,
    );
    const anySuccess = textSuccess || mediaSuccess;
    const allSuccess =
      (!text || text.guard.approved) &&
      staged.every(
        ({ result: r }) =>
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
      const previous = baseResults.find(
        (r) =>
          r.sourceMediaId === source.id &&
          r.status === IdeaAiMediaStatus.ENHANCED,
      );
      if (
        anySuccess &&
        previous &&
        result.status !== IdeaAiMediaStatus.ENHANCED
      ) {
        await this.carry(
          attempt.id,
          previous,
          manager,
          result.errorCode ??
            (result.status === IdeaAiMediaStatus.REJECTED_BY_GUARD
              ? IdeaAiErrorCode.GUARD_REJECTED
              : null),
        );
        continue;
      }
      const saved =
        url && result.artifact
          ? await this.saveArtifact(
              manager,
              attempt.sectionId,
              source,
              source.mediaType,
              url,
              result.artifact.name,
              result.artifact.buffer.length,
            )
          : null;
      const editable =
        editableUrl && result.editable
          ? await this.saveArtifact(
              manager,
              attempt.sectionId,
              source,
              MediaType.DOCUMENT,
              editableUrl,
              result.editable.name,
              result.editable.buffer.length,
            )
          : null;
      await this.repo.saveMediaResult(
        {
          enhancementId: attempt.id,
          sourceMediaId: source.id,
          kind: this.kind(source),
          status: result.status,
          skipReason: result.skipReason ?? null,
          enhancedMediaId: saved?.id ?? null,
          editableMediaId: editable?.id ?? null,
          guard: result.guard ? { ...result.guard } : null,
          errorCode: result.errorCode ?? null,
          carriedOver: false,
        },
        manager,
      );
    }
    if (anySuccess) {
      const redone = new Set(staged.map((s) => s.result.sourceMediaId));
      for (const previous of baseResults)
        if (!redone.has(previous.sourceMediaId))
          await this.carry(attempt.id, previous, manager, null);
      await this.repo.clearCurrent(attempt.sectionId, manager);
    }

    const keepTitle = !text || (!text.title && anySuccess);
    const keepDescription = !text || (!text.description && anySuccess);
    await this.repo.saveAttempt(
      {
        id: attempt.id,
        status,
        enhancedTitle: keepTitle ? (base?.enhancedTitle ?? null) : text.title,
        enhancedDescription: keepDescription
          ? (base?.enhancedDescription ?? null)
          : text.description,
        textGuard: text ? { ...text.guard } : (base?.textGuard ?? null),
        currentResultSectionId: anySuccess ? attempt.sectionId : null,
        errorCode: anySuccess
          ? null
          : (textError ??
            staged.find((s) => s.result.errorCode)?.result.errorCode ??
            IdeaAiErrorCode.GUARD_REJECTED),
        progressDone: attempt.progressTotal,
        activeSectionId: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        finishedAt: new Date(),
      },
      manager,
    );
    this.logger.log(
      `Melhoria ${attempt.id} da ideia ${attempt.sectionId}: ${status} em ${Date.now() - started} ms (${staged.length} material(is) refeito(s)).`,
    );
  }

  private carry(
    enhancementId: string,
    previous: IdeasSectionAiMediaEnhancementEntity,
    manager: EntityManager,
    errorCode: IdeaAiErrorCode | null,
  ): Promise<IdeasSectionAiMediaEnhancementEntity> {
    return this.repo.saveMediaResult(
      {
        enhancementId,
        sourceMediaId: previous.sourceMediaId,
        kind: previous.kind,
        status: previous.status,
        skipReason: previous.skipReason,
        enhancedMediaId: previous.enhancedMediaId,
        editableMediaId: previous.editableMediaId,
        guard: previous.guard,
        errorCode,
        carriedOver: true,
      },
      manager,
    );
  }

  private kind(source: MediaItemEntity): IdeaAiMediaKind {
    return source.mediaType === MediaType.IMAGE
      ? IdeaAiMediaKind.IMAGE
      : source.mediaType === MediaType.DOCUMENT
        ? IdeaAiMediaKind.DOCUMENT
        : IdeaAiMediaKind.VIDEO;
  }

  private saveArtifact(
    manager: EntityManager,
    sectionId: string,
    source: MediaItemEntity,
    mediaType: MediaType,
    url: string,
    originalName: string,
    size: number,
  ): Promise<MediaItemEntity> {
    return this.media.saveMediaItemInTransaction(manager, {
      title: source.title,
      description: '',
      mediaType,
      uploadType: UploadType.UPLOAD,
      isLocalFile: true,
      url,
      originalName,
      size,
      targetId: sectionId,
      targetType: MediaTargetType.IdeasSectionAiEnhancedMedia,
    });
  }
}
