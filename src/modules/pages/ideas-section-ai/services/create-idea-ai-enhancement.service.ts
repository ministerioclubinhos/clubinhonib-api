import { Injectable, Logger } from '@nestjs/common';
import {
  AppBusinessException,
  AppConflictException,
  AppForbiddenException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { CreateIdeaSnapshotService } from './create-idea-snapshot.service';
import {
  IDEA_AI,
  IDEA_AI_ACTIVE,
  IDEA_AI_FULL_REQUEST,
  IDEA_AI_RETRYABLE_MEDIA,
} from '../constants';
import {
  IdeaAiEnhancementStatus,
  IdeaAiScope,
} from '../enums/ideas-section-ai.enums';
import { IdeaAiQueuedDto } from '../dto/idea-ai-response.dto';
import { CreateIdeaAiEnhancementDto } from '../dto/create-idea-ai-enhancement.dto';
import { IdeaAiAttemptTarget } from '../types';
import {
  countsTowardIdeaAiLimit,
  ideaAiProviderReady,
  isIdeaAiVideo,
} from '../utils';
import { IdeasSectionAiEnhancementEntity } from '../entities/ideas-section-ai-enhancement.entity';
import { IdeasSectionSubmissionSnapshotEntity } from '../entities/ideas-section-submission-snapshot.entity';
import { IdeasSectionAiMediaEnhancementEntity } from '../entities/ideas-section-ai-media-enhancement.entity';

@Injectable()
export class CreateIdeaAiEnhancementService {
  private readonly logger = new Logger(CreateIdeaAiEnhancementService.name);

  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly snapshots: CreateIdeaSnapshotService,
    private readonly media: MediaItemProcessor,
    private readonly settings: GetAiProviderSettingsService,
    private readonly flags: GetFeatureFlagsService,
  ) {}

  /** Teacher submission: only with the flag on and a configured provider. */
  /** A flag vale para todos os perfis: é um interruptor do sistema. */
  isEnabled(): Promise<boolean> {
    return this.flags.isSwitchedOn(FeatureFlagKeys.IDEA_AI_ENHANCEMENT, false);
  }

  async enqueueAutomatic(sectionId: string): Promise<void> {
    if (!(await this.isEnabled())) return;
    const settings = await this.settings.getInternalSettings();
    if (!ideaAiProviderReady(settings)) {
      this.logger.warn(
        `Melhoria automática da ideia ${sectionId} não iniciada: provedor de IA sem configuração.`,
      );
      return;
    }
    await this.create(sectionId, IDEA_AI_FULL_REQUEST, true);
  }

  /**
   * Queues an attempt. Partial scopes reuse the current result for every item
   * they do not redo, so only the targeted items cost new calls.
   */
  async create(
    sectionId: string,
    request: CreateIdeaAiEnhancementDto = IDEA_AI_FULL_REQUEST,
    automatic = false,
  ): Promise<IdeaAiQueuedDto> {
    // A flag governa todo o fluxo de IA das ideias, não só o automático.
    if (!(await this.isEnabled()))
      throw new AppForbiddenException(
        ErrorCode.FEATURE_DISABLED,
        'A melhoria de ideias por IA está desligada.',
      );
    const settings = await this.settings.getInternalSettings();
    if (!ideaAiProviderReady(settings))
      throw new AppBusinessException(
        ErrorCode.IDEA_AI_PROVIDER_NOT_CONFIGURED,
        'Configure o provedor de IA (chave e modelo de texto) antes de melhorar a ideia.',
      );
    const configured = settings[settings.llmProvider];
    return this.repo.transaction(async (manager) => {
      const section = await this.repo.lockSection(sectionId, manager);
      if (!section)
        throw new AppNotFoundException(
          ErrorCode.IDEA_NOT_FOUND,
          'Ideia não encontrada.',
        );
      if (section.page)
        throw new AppConflictException(
          ErrorCode.IDEA_AI_ALREADY_PUBLISHED,
          automatic
            ? 'A ideia já foi publicada; a melhoria automática não será iniciada.'
            : 'Esta ideia já foi publicada. Uma nova melhoria não teria efeito.',
        );
      const history = await this.repo.attempts([sectionId], manager);
      if (history.some((a) => IDEA_AI_ACTIVE.includes(a.status)))
        throw new AppConflictException(
          ErrorCode.IDEA_AI_ENHANCEMENT_IN_PROGRESS,
          'A IA já está melhorando esta ideia. Aguarde a conclusão.',
        );
      if (history.filter(countsTowardIdeaAiLimit).length >= IDEA_AI.maxAttempts)
        throw new AppConflictException(
          ErrorCode.IDEA_AI_ATTEMPT_LIMIT,
          `Esta ideia atingiu o limite de ${IDEA_AI.maxAttempts} tentativas. O original continua disponível.`,
        );
      const medias = await this.media.findMediaItemsByTargetInTransaction(
        manager,
        sectionId,
        MediaTargetType.IdeasSection,
      );
      const snapshot = await this.snapshots.capture(section, medias, manager);
      const current = history.find(
        (a) => a.currentResultSectionId === sectionId,
      );
      const results = current
        ? await this.repo.mediaResults([current.id], manager)
        : [];
      const target = this.resolveTarget(request, snapshot, current, results);
      const attempt = await this.repo.saveAttempt(
        {
          sectionId,
          snapshotId: snapshot.id,
          attempt: (history[0]?.attempt ?? 0) + 1,
          activeSectionId: sectionId,
          currentResultSectionId: null,
          status: IdeaAiEnhancementStatus.PENDING,
          provider: settings.llmProvider,
          textModel: configured.generalModel,
          imageModel: configured.imageModel,
          promptVersion: IDEA_AI.promptVersion,
          requestedAt: new Date(),
          scope: request.scope,
          includeText: target.includeText,
          targetMediaIds: target.mediaIds,
          baseEnhancementId: target.baseEnhancementId,
          instructions: request.instructions ?? null,
          // Vídeos são pulados sem passar pela IA: não contam no progresso.
          progressTotal:
            (target.includeText ? 1 : 0) +
            snapshot.medias.filter(
              (m) =>
                !isIdeaAiVideo(m.sourceMedia) &&
                (target.mediaIds === null ||
                  target.mediaIds.includes(m.sourceMediaId)),
            ).length,
        },
        manager,
      );
      this.logger.log(
        `Melhoria ${attempt.id} da ideia ${sectionId} na fila (tentativa ${attempt.attempt}, escopo ${request.scope}${automatic ? ', automática' : ''}).`,
      );
      return {
        id: attempt.id,
        attempt: attempt.attempt,
        status: attempt.status,
      };
    });
  }

  private resolveTarget(
    request: CreateIdeaAiEnhancementDto,
    snapshot: IdeasSectionSubmissionSnapshotEntity,
    current: IdeasSectionAiEnhancementEntity | undefined,
    results: IdeasSectionAiMediaEnhancementEntity[],
  ): IdeaAiAttemptTarget {
    if (request.scope === IdeaAiScope.FULL)
      return { includeText: true, mediaIds: null, baseEnhancementId: null };
    if (!current)
      throw new AppBusinessException(
        ErrorCode.IDEA_AI_INVALID_SCOPE,
        'Ainda não há resultado para complementar. Gere a melhoria completa primeiro.',
      );
    if (request.scope === IdeaAiScope.TEXT)
      return { includeText: true, mediaIds: [], baseEnhancementId: current.id };
    if (request.scope === IdeaAiScope.MEDIA) {
      const supported = new Set(
        snapshot.medias
          .filter(
            (m) =>
              m.sourceMedia.isLocalFile &&
              (m.sourceMedia.mediaType === MediaType.IMAGE ||
                m.sourceMedia.mediaType === MediaType.DOCUMENT),
          )
          .map((m) => m.sourceMediaId),
      );
      const mediaIds = request.mediaIds ?? [];
      if (!mediaIds.length || mediaIds.some((id) => !supported.has(id)))
        throw new AppBusinessException(
          ErrorCode.IDEA_AI_INVALID_SCOPE,
          'Escolha ao menos um documento ou imagem enviado pelo professor.',
        );
      return { includeText: false, mediaIds, baseEnhancementId: current.id };
    }
    const failedMedia = results
      .filter(
        (r) =>
          r.enhancementId === current.id &&
          IDEA_AI_RETRYABLE_MEDIA.includes(r.status),
      )
      .map((r) => r.sourceMediaId);
    const textFailed =
      current.enhancedTitle === null || current.enhancedDescription === null;
    if (!textFailed && !failedMedia.length)
      throw new AppBusinessException(
        ErrorCode.IDEA_AI_INVALID_SCOPE,
        'Nada falhou no resultado atual. Escolha outro tipo de regeneração.',
      );
    return {
      includeText: textFailed,
      mediaIds: failedMedia,
      baseEnhancementId: current.id,
    };
  }
}
