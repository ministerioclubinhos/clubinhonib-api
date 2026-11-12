import {
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { createHash, randomUUID } from 'node:crypto';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  AppBusinessException,
  AppConflictException,
  AppException,
  ErrorCode,
} from 'src/shared/exceptions';
import {
  CUTOUT_KIT_CORRECTION_INSTRUCTIONS,
  STORY_VISUAL_CORRECTION_INSTRUCTIONS,
  STORY_VISUAL_MAX_CORRECTIONS,
} from '../constants/story-visual-quality.constants';
import {
  LESSON_CHANGE_SUMMARY_MAX_LENGTH,
  LESSON_DERIVED_VERSE_STAGES,
  LESSON_GAME_RETRY_INSTRUCTION,
  LESSON_GAME_STAGES,
  LESSON_GENERATION,
  LESSON_GENERATION_BLOCKED_STATUSES,
  LESSON_REGENERATION_LOCKED_STAGE_STATUSES,
} from '../constants/lesson-workflow.constants';
import {
  GenerateStageRequestDto,
  RegenerateStageImagesRequestDto,
} from '../dto/generate-stage-request.dto';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import {
  getLessonStageOrder,
  LessonCategory,
  LessonStageStatus,
  LessonStageType,
  LessonVersionSource,
  LessonVisualType,
} from '../enums/lesson.enums';
import {
  LessonFailureCode,
  LessonWorkflowAction,
} from '../enums/lesson-failure-code.enum';
import { LESSON_LLM_PROVIDER } from '../providers/lesson-llm.constants';
import {
  LessonAttemptProviderMetadata,
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
  LessonLlmProvider,
  LessonLlmProviderContract,
  LessonLlmUsage,
} from '../providers/lesson-llm.types';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { getLessonTemplate } from '../templates/special-lesson-templates';
import { templateChecksum } from '../templates/lesson-templates';
import type {
  LessonActiveGeneration,
  LessonGenerationCheckpoint,
  LessonGenerationRequest,
  LessonJsonObject,
} from '../types/lesson-generation.types';
import { lessonString } from '../utils';
import {
  describeAiFailure,
  LessonGenerationAbortedError,
  LessonGenerationAttemptsExhaustedError,
} from '../utils/lesson-ai-failure.utils';
import {
  isNewGameFromHistory,
  validateCanonicalContent,
  validateVisualConfig,
} from '../utils/lesson-generation-validation.utils';
import { lessonContentToTiptap } from '../utils/lesson-tiptap.utils';
import {
  canonicalVerseFromLesson,
  lockDerivedVerse,
} from '../utils/lesson-verse.utils';
import {
  assertLessonDependency,
  assertPreviousStageCompleted,
  lessonAsObject,
  lessonContentAssetUrls,
  lessonContentChecksum,
  lessonCurrentContent,
} from '../utils/lesson-workflow.utils';
import {
  createOlderMeditation,
  createOlderMeditationImages,
} from '../utils/older-meditation-generation.utils';
import { olderMeditationLessonSource } from '../utils/older-meditation-quality.utils';
import { AdminLessonPromptService } from './admin-lesson-prompt.service';
import { GetLessonService } from './get-lesson.service';
import { LessonStudioSupportService } from './lesson-studio-support.service';
import { LessonAssetGenerationService } from './lesson-asset-generation.service';
import { LessonImageBriefService } from './lesson-image-brief.service';
import { withoutImageBrief } from '../utils/lesson-image-brief.utils';
import {
  imageRegenerationSummary,
  imageSelectionOutdated,
  imageBriefOriginOf,
  isImageRegeneration,
  planImageRegeneration,
  regeneratesEveryImage,
  visualChoicesOfContent,
} from '../utils/lesson-image-regeneration.utils';
import { LessonGenerationProgressService } from './lesson-generation-progress.service';
import { LessonGenerationPhase } from '../enums/lesson-generation-phase.enum';
import {
  lessonAssetListKey,
  lessonNotFound,
  stageNotFound,
  throwIfGenerationAborted,
} from '../utils/lesson-studio-errors.utils';

/** Background generation of stages: request, database lease, heartbeat, resume, checkpoints and commit. */
@Injectable()
export class LessonGenerationService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(LessonGenerationService.name);
  private readonly activeGenerations = new Map<
    string,
    LessonActiveGeneration
  >();
  private readonly maxConcurrentGenerations: number;
  private shuttingDown = false;

  constructor(
    private readonly repo: AiLessonsRepository,
    @Inject(LESSON_LLM_PROVIDER)
    private readonly llm: LessonLlmProviderContract,
    private readonly adminPrompts: AdminLessonPromptService,
    private readonly config: ConfigService,
    private readonly support: LessonStudioSupportService,
    private readonly lessons: GetLessonService,
    private readonly assets: LessonAssetGenerationService,
    private readonly progress: LessonGenerationProgressService,
    private readonly imageBriefs: LessonImageBriefService,
  ) {
    this.maxConcurrentGenerations = Math.max(
      1,
      Number(
        this.config.get<string>(LESSON_GENERATION.MAX_CONCURRENT_CONFIG_KEY),
      ) || LESSON_GENERATION.DEFAULT_MAX_CONCURRENT,
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.resumePendingGenerations();
  }

  /**
   * Stops this instance's attempts and hands their leases back, so another
   * instance (or this one after the restart) resumes them without waiting for
   * the lease to expire.
   */
  async onApplicationShutdown(): Promise<void> {
    this.shuttingDown = true;
    const active = [...this.activeGenerations.values()];
    for (const generation of active) {
      clearInterval(generation.heartbeat);
      generation.abort.abort();
    }
    await Promise.all(
      active.map((generation) =>
        this.repo
          .releaseGenerationLease(generation.stageId, generation.attemptToken)
          .catch((error: unknown) => {
            this.logger.warn(
              `Falha ao liberar a lease da etapa ${generation.stageId} no encerramento: ${String(error)}`,
            );
          }),
      ),
    );
  }

  /**
   * In-process poller. It does not use the cron job runner on purpose: it is
   * not a scheduled notification but the worker of user-requested generations,
   * and its multi-instance safety comes from the database lease, not from
   * `SCHEDULER_ENABLED`.
   */
  @Interval(LESSON_GENERATION.RESUME_INTERVAL_MS)
  async resumePendingGenerations(): Promise<void> {
    if (this.shuttingDown) return;
    try {
      await this.claimPendingGenerations();
    } catch (error: unknown) {
      this.logger.warn(`Falha ao retomar gerações pendentes: ${String(error)}`);
    }
  }

  private kickResume(): void {
    this.resumePendingGenerations().catch((error: unknown) => {
      this.logger.warn(`Falha ao acionar a fila de gerações: ${String(error)}`);
    });
  }

  private generationKey(
    stage: Pick<LessonStageEntity, 'lessonId' | 'type'>,
  ): string {
    return `${stage.lessonId}:${stage.type}`;
  }

  private async claimPendingGenerations(): Promise<void> {
    const pending = await this.repo.findGeneratingStages();
    for (const stage of pending) {
      if (this.activeGenerations.size >= this.maxConcurrentGenerations) break;
      // Already running here: claiming again would steal our own lease.
      if (this.activeGenerations.has(this.generationKey(stage))) continue;
      try {
        await this.claimAndStart(stage);
      } catch (error: unknown) {
        this.logger.warn(
          `Falha ao assumir a geração ${this.generationKey(stage)}: ${String(error)}`,
        );
      }
    }
  }

  private async claimAndStart(pending: LessonStageEntity): Promise<void> {
    if (!pending.generationRequestJson || !pending.generationRequestedById) {
      await this.failGenerationWithoutRequest(pending);
      return;
    }
    // Each attempt needs its own UUID to fit generation_lease_owner (varchar(36)).
    const attemptToken = randomUUID();
    const claimed = await this.repo.claimGeneration(
      pending.id,
      attemptToken,
      LESSON_GENERATION.LEASE_SECONDS,
    );
    if (!claimed) return;
    // Read again after the claim: a previous owner may have recorded uploads
    // between the listing and the claim, and can no longer write from now on.
    const stage = (await this.repo.findStageById(pending.id)) ?? pending;
    const request = stage.generationRequestJson;
    if (!request || !stage.generationRequestedById) {
      await this.failGenerationWithoutRequest(stage);
      return;
    }
    const attempts = (request.attempts ?? 0) + 1;
    if (attempts > LESSON_GENERATION.MAX_ATTEMPTS) {
      await this.failInterruptedGeneration(
        stage.lessonId,
        stage.type,
        attemptToken,
        new LessonGenerationAttemptsExhaustedError(),
      );
      return;
    }
    const nextRequest: LessonGenerationRequest = { ...request, attempts };
    const stillOwner = await this.repo.updateGenerationRequest(
      stage.id,
      attemptToken,
      nextRequest,
    );
    if (!stillOwner) return;
    stage.generationRequestJson = nextRequest;
    stage.generationLeaseOwner = attemptToken;
    this.startGeneration(stage, attemptToken);
  }

  private async failGenerationWithoutRequest(
    pending: LessonStageEntity,
  ): Promise<void> {
    await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(
        pending.lessonId,
        manager,
      );
      const stage = locked?.stages.find((item) => item.id === pending.id);
      if (
        !locked ||
        !stage ||
        stage.status !== LessonStageStatus.GENERATING ||
        (stage.generationRequestJson && stage.generationRequestedById)
      )
        return;
      stage.status = LessonStageStatus.FAILED;
      await this.repo.updateStage(
        stage.id,
        {
          status: LessonStageStatus.FAILED,
          failureCode: LessonFailureCode.GENERATION_REQUEST_MISSING,
          failureMessage:
            'A geração interrompida não possuía dados para retomada. Tente novamente.',
          generationRequestJson: null,
          generationRequestedById: null,
          generationLeaseOwner: null,
          generationLeaseUntil: null,
        },
        manager,
      );
      await this.support.syncLessonStatus(locked, manager);
    });
  }

  async generateStage(
    id: string,
    dto: GenerateStageRequestDto,
    userId: string,
  ): Promise<LessonEntity> {
    const { stage: type } = dto;
    const header = await this.repo.findLessonHeader(id);
    if (!header) throw lessonNotFound();
    if (!getLessonStageOrder(header.category).includes(type))
      throw new AppBusinessException(
        ErrorCode.LESSON_INVALID_REQUEST,
        'Esta etapa não pertence a este tipo de material.',
      );
    // Input errors are answered now (400), never as a failed background job.
    if (type === LessonStageType.LESSON_VISUALS)
      validateVisualConfig(dto, header.category);
    const { frozenAdminPrompt, frozenProvider } =
      await this.freezeGenerationContext(
        userId,
        type,
        header.category,
        dto.visualType,
      );

    await this.openGenerationRequest(id, type, userId, (lockedStage) => ({
      stage: type,
      revisionInstructions: dto.revisionInstructions,
      visualType: dto.visualType,
      visualOrientation: dto.visualOrientation,
      visualQuantity: dto.visualQuantity,
      visualStyle: dto.visualStyle,
      frozenProvider,
      frozenAdminPrompt,
      attempts: 0,
      uploadedAssetUrls: [],
      checkpoint: null,
      previousState: { status: lockedStage.status },
    }));
    this.support.audit(LessonWorkflowAction.GENERATE_STAGE, id, userId, {
      stage: type,
    });
    return this.announceGeneration(id, type, userId, dto.visualQuantity);
  }

  /**
   * Generates again only the chosen images of the current version. The text
   * and the other images enter the request as an already-paid checkpoint, so
   * the regular attempt (lease, resume, progress, commit) does the rest.
   */
  async regenerateImages(
    id: string,
    dto: RegenerateStageImagesRequestDto,
    userId: string,
  ): Promise<LessonEntity> {
    const { stage: type } = dto;
    const current = await this.lessons.getById(id);
    const stage = current.stages.find((item) => item.type === type);
    if (!stage) throw stageNotFound();
    if (stage.lockVersion !== dto.lockVersion) throw imageSelectionOutdated();
    if (stage.status === LessonStageStatus.STALE)
      throw new AppConflictException(
        ErrorCode.LESSON_STAGE_STALE_UPSTREAM,
        'Este item está desatualizado em relação aos anteriores. Gere o item novamente por completo.',
      );
    const content = lessonCurrentContent(stage);
    const plan = planImageRegeneration(type, content, dto.assetIds);
    const upstream = assertLessonDependency(current, type);
    const { frozenAdminPrompt, frozenProvider } =
      await this.freezeGenerationContext(
        userId,
        type,
        current.category,
        visualChoicesOfContent(content).visualType,
      );

    await this.openGenerationRequest(id, type, userId, (lockedStage) => {
      // The plan was built outside the lock: it only holds for that version.
      if (
        lockedStage.lockVersion !== dto.lockVersion ||
        lockedStage.currentVersionId !== stage.currentVersionId
      )
        throw imageSelectionOutdated();
      return {
        stage: type,
        ...visualChoicesOfContent(content),
        frozenProvider,
        frozenAdminPrompt,
        attempts: 0,
        // Kept images are not uploads of this request: a failure must never
        // remove them, they belong to the version in use.
        uploadedAssetUrls: [],
        checkpoint: {
          upstreamChecksum: upstream ? lessonContentChecksum(upstream) : null,
          // Redoing every image redoes the master prompt too; redoing some
          // keeps it, so the new images follow the same art direction.
          content: regeneratesEveryImage(plan)
            ? withoutImageBrief(content as LessonJsonObject)
            : (content as LessonJsonObject),
          responseId: '',
          assetUrls: plan.keptAssetUrls,
        },
        previousState: { status: lockedStage.status },
        regeneratedAssetIds: plan.regeneratedAssetIds,
        imageInstructions: dto.instructions || undefined,
      };
    });
    this.support.audit(LessonWorkflowAction.REGENERATE_IMAGES, id, userId, {
      stage: type,
      versionId: stage.currentVersionId ?? undefined,
    });
    return this.announceGeneration(id, type, userId, plan.totalImages);
  }

  /** Opens the progress record and wakes the worker loop. */
  private async announceGeneration(
    id: string,
    type: LessonStageType,
    userId: string,
    expectedImages: number | undefined,
  ): Promise<LessonEntity> {
    const lesson = await this.lessons.getById(id);
    // Opened before the work starts, so the clock counts from the request.
    await this.progress.begin({
      lessonId: id,
      theme: lesson.theme,
      stage: type,
      requestedById: userId,
      expectedImages,
      reset: true,
    });
    this.kickResume();
    return lesson;
  }

  /** Shared gate of every generation request: one per lesson, never in review. */
  private async openGenerationRequest(
    id: string,
    type: LessonStageType,
    userId: string,
    buildRequest: (lockedStage: LessonStageEntity) => LessonGenerationRequest,
  ): Promise<void> {
    await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!locked) throw lessonNotFound();
      const lockedStage = locked.stages.find((item) => item.type === type);
      if (!lockedStage) throw stageNotFound();
      if (lockedStage.status === LessonStageStatus.GENERATING)
        throw new AppConflictException(
          ErrorCode.LESSON_GENERATION_IN_PROGRESS,
          'Esta etapa já está sendo gerada.',
        );
      if (
        locked.stages.some(
          (item) => item.status === LessonStageStatus.GENERATING,
        )
      )
        throw new AppConflictException(
          ErrorCode.LESSON_GENERATION_IN_PROGRESS,
          'Já existe uma etapa sendo gerada nesta lição.',
        );
      if (LESSON_GENERATION_BLOCKED_STATUSES.includes(locked.status))
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          'A produção não pode ser regenerada durante ou depois da revisão final.',
        );
      // An item the reviewer holds or approved is shielded: it must be
      // returned or reopened before a new generation replaces it.
      if (
        LESSON_REGENERATION_LOCKED_STAGE_STATUSES.includes(lockedStage.status)
      )
        throw new AppConflictException(
          ErrorCode.LESSON_INVALID_STATE,
          lockedStage.status === LessonStageStatus.APPROVED
            ? 'Este item já foi aprovado e está protegido. Reabra o item na revisão antes de gerar novamente.'
            : 'Este item está em revisão. Devolva o item com um pedido de ajustes antes de gerar novamente.',
        );
      assertPreviousStageCompleted(locked, type);
      const request = buildRequest(lockedStage);
      const activeTemplate = getLessonTemplate(
        type,
        locked.category,
        request.visualType ?? null,
      );
      lockedStage.status = LessonStageStatus.GENERATING;
      await this.repo.updateStage(
        lockedStage.id,
        {
          templateKey: activeTemplate.key,
          templateVersion: activeTemplate.version,
          templateChecksum: templateChecksum(activeTemplate),
          status: LessonStageStatus.GENERATING,
          failureCode: null,
          failureMessage: null,
          generationRequestJson:
            request as QueryDeepPartialEntity<LessonGenerationRequest>,
          generationRequestedById: userId,
          generationLeaseOwner: null,
          generationLeaseUntil: null,
        },
        manager,
      );
      await this.support.syncLessonStatus(locked, manager);
    });
  }

  /**
   * Resolves, on the server, everything a generation must keep stable across
   * retries: the effective admin prompt and the provider/model snapshot. A
   * failure here fails the request instead of silently generating unfrozen.
   */
  private async freezeGenerationContext(
    userId: string,
    type: LessonStageType,
    category: LessonCategory,
    visualType?: string | null,
  ): Promise<{
    frozenAdminPrompt: string;
    frozenProvider?: LessonAttemptProviderMetadata;
  }> {
    try {
      const frozenAdminPrompt = await this.adminPrompts.effective(
        userId,
        type,
        category,
        visualType,
      );
      const snapshot = await this.resolveAttemptProvider();
      return { frozenAdminPrompt, frozenProvider: snapshot.metadata };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.logger.error(
        `Falha ao congelar prompt/provedor da geração ${type}: ${String(error)}`,
      );
      throw new AppException(
        ErrorCode.LESSON_PROVIDER_SNAPSHOT_UNAVAILABLE,
        'Não foi possível carregar as configurações de IA para iniciar a geração. Verifique a configuração de provedores e tente novamente.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  /**
   * Provider bound to the frozen snapshot of the request. Providers without
   * per-attempt snapshots (the contract makes it optional) are used as is.
   */
  private async resolveAttemptProvider(
    frozen?: LessonAttemptProviderMetadata,
  ): Promise<{
    provider: LessonLlmProviderContract;
    metadata?: LessonAttemptProviderMetadata;
  }> {
    if (!this.llm.createAttemptProvider)
      return { provider: this.llm, metadata: frozen };
    return this.llm.createAttemptProvider(frozen);
  }

  private startGeneration(
    stage: LessonStageEntity,
    attemptToken: string,
  ): void {
    const key = this.generationKey(stage);
    if (this.activeGenerations.has(key)) return;
    const abort = new AbortController();
    const heartbeat = setInterval(() => {
      this.repo
        .renewGenerationLease(
          stage.id,
          attemptToken,
          LESSON_GENERATION.LEASE_SECONDS,
        )
        .then((renewed) => {
          if (renewed !== false) void this.progress.touch(stage.lessonId);
          if (renewed === false) {
            // Someone else owns the stage now: stop paying for this attempt.
            this.logger.warn(
              `Lease da etapa ${stage.type} (${stage.id}) perdida por ${attemptToken}; tentativa interrompida.`,
            );
            abort.abort();
          }
        })
        .catch((err: unknown) => {
          this.logger.warn(
            `Falha ao renovar lease da etapa ${stage.type}: ${String(err)}`,
          );
        });
    }, LESSON_GENERATION.HEARTBEAT_INTERVAL_MS);
    heartbeat.unref();
    this.activeGenerations.set(key, {
      stageId: stage.id,
      attemptToken,
      heartbeat,
      abort,
    });
    this.executeStageGeneration(
      stage.lessonId,
      stage.generationRequestJson!,
      stage.generationRequestedById!,
      attemptToken,
      abort.signal,
    )
      .catch((error: unknown) =>
        this.failInterruptedGeneration(
          stage.lessonId,
          stage.type,
          attemptToken,
          error,
        ),
      )
      .catch((error: unknown) => {
        this.logger.error(
          `Falha ao registrar o erro da geração ${key}: ${String(error)}`,
        );
      })
      .finally(() => {
        clearInterval(heartbeat);
        this.activeGenerations.delete(key);
        // A shutdown leaves the record: the resumed attempt continues it.
        if (!this.shuttingDown) void this.progress.finish(stage.lessonId);
        if (
          !this.shuttingDown &&
          this.activeGenerations.size < this.maxConcurrentGenerations
        ) {
          this.kickResume();
        }
      });
  }

  /**
   * Records the failure of the attempt that owns the lease. Returns whether
   * this attempt was the owner; a non-owner must not touch the stage.
   */
  private async failInterruptedGeneration(
    lessonId: string,
    type: LessonStageType,
    attemptToken: string,
    error: unknown,
  ): Promise<boolean> {
    let abandonedUploads: string[] = [];
    const recorded = await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(lessonId, manager);
      if (!locked) return false;
      const stage = locked.stages.find((item) => item.type === type);
      if (!stage || stage.status !== LessonStageStatus.GENERATING) return false;
      if (stage.generationLeaseOwner !== attemptToken) return false;
      const request = stage.generationRequestJson;
      const failure = describeAiFailure(type, error, {
        provider: request?.frozenProvider?.provider,
        stageOrder: getLessonStageOrder(locked.category),
      });
      // A failed regeneration must not cost the item its previous standing:
      // the saved version is intact, so its status is restored.
      const previous = request?.previousState?.status;
      const restorable =
        Boolean(stage.currentVersionId) &&
        previous !== undefined &&
        previous !== LessonStageStatus.GENERATING &&
        previous !== LessonStageStatus.NOT_STARTED;
      stage.status = restorable ? previous : LessonStageStatus.FAILED;
      stage.failureCode = failure.code;
      stage.failureMessage = failure.message;
      await this.repo.updateStage(
        stage.id,
        {
          status: stage.status,
          failureCode: failure.code,
          failureMessage: failure.message,
          generationRequestJson: null,
          generationRequestedById: null,
          generationLeaseOwner: null,
          generationLeaseUntil: null,
        },
        manager,
      );
      await this.support.syncLessonStatus(locked, manager);
      abandonedUploads = request?.uploadedAssetUrls ?? [];
      this.logger.error(
        `Geração ${lessonId}:${type} falhou (${failure.code}): ${failure.message}`,
      );
      return true;
    });
    if (recorded) await this.support.discardUploads(abandonedUploads);
    return recorded;
  }

  private async executeStageGeneration(
    id: string,
    initialRequest: LessonGenerationRequest,
    userId: string,
    attemptToken: string,
    signal?: AbortSignal,
  ): Promise<void> {
    const { stage: type, revisionInstructions } = initialRequest;
    // Uploads of this attempt that the persisted request does not know about.
    const unrecordedUploads = new Set<string>();
    const freshUploads: string[] = [];
    let request: LessonGenerationRequest = initialRequest;
    let stageId: string | undefined;
    const persistRequest = async (
      next: LessonGenerationRequest,
    ): Promise<void> => {
      if (!stageId) return;
      const owned = await this.repo.updateGenerationRequest(
        stageId,
        attemptToken,
        next,
      );
      // Losing the lease mid-flight: stop before paying for anything else.
      if (owned === false) throw new LessonGenerationAbortedError();
      request = next;
    };
    try {
      throwIfGenerationAborted(signal);
      const lesson = await this.lessons.getById(id);
      const stage = lesson.stages.find((item) => item.type === type);
      if (!stage) throw stageNotFound();
      stageId = stage.id;
      await this.progress.begin({
        lessonId: id,
        theme: lesson.theme,
        stage: type,
        requestedById: userId,
        expectedImages: request.visualQuantity,
      });
      const isGameStage = LESSON_GAME_STAGES.includes(type);
      const previousGameVariants = isGameStage
        ? (stage.versions ?? [])
            .map((version) => lessonAsObject(version.structuredDataJson))
            .filter((content) => Boolean(lessonString(content.name)))
            .map((content) => ({
              name: content.name,
              objective: content.objective,
              funMechanics: content.funMechanics,
              materials: content.materials,
              preparation: content.preparation,
              steps: content.steps,
            }))
        : [];
      const upstream = assertLessonDependency(lesson, type);
      const upstreamChecksum = upstream
        ? lessonContentChecksum(upstream)
        : null;
      const template = getLessonTemplate(
        type,
        lesson.category,
        request.visualType ?? null,
      );
      const visualConfig =
        type === LessonStageType.LESSON_VISUALS
          ? validateVisualConfig(request, lesson.category)
          : null;
      const attemptSnapshot = await this.resolveAttemptProvider(
        request.frozenProvider,
      );
      const attemptLlm = attemptSnapshot.provider;
      const adminPrompt =
        request.frozenAdminPrompt ??
        (await this.adminPrompts.effective(
          userId,
          type,
          lesson.category,
          visualConfig?.type,
        ));
      const approvedLessonStage = lesson.stages.find(
        (item) => item.type === LessonStageType.LESSON,
      );
      const generationInput: LessonLlmGenerationInput = {
        theme: lesson.theme,
        biblicalReference: lesson.biblicalReference,
        weekNumber: lesson.weekNumber,
        category: lesson.category,
        specialContext: lesson.specialContext,
        editorialPurpose: lesson.editorialPurpose ?? null,
        stage: type,
        template,
        approvedUpstream:
          type === LessonStageType.MEDITATION_OLDER
            ? olderMeditationLessonSource(
                approvedLessonStage
                  ? lessonCurrentContent(approvedLessonStage)
                  : null,
              )
            : upstream,
        previousVariants: previousGameVariants,
        canonicalVerse: [
          LessonStageType.VERSE_VISUALS,
          LessonStageType.VERSE_FIXATION,
        ].includes(type)
          ? canonicalVerseFromLesson(lesson)
          : null,
        adminPrompt,
        revisionInstructions,
        visualConfig,
      };

      // Work already paid for by an interrupted attempt is reused only while
      // the upstream content it was produced from is unchanged.
      let checkpoint: LessonGenerationCheckpoint | null =
        request.checkpoint &&
        request.checkpoint.upstreamChecksum === upstreamChecksum
          ? request.checkpoint
          : null;
      // Regenerating images never rewrites the text: without a valid
      // checkpoint there is nothing to keep, so the request fails instead.
      if (isImageRegeneration(request) && !checkpoint)
        throw new ConflictException(
          'Os itens anteriores mudaram enquanto as imagens eram regeradas. Gere o item novamente por completo.',
        );
      if (request.checkpoint && !checkpoint)
        await persistRequest({ ...request, checkpoint: null });

      if (!checkpoint) {
        let generated = await attemptLlm.generateStage(generationInput);
        throwIfGenerationAborted(signal);
        if (
          isGameStage &&
          previousGameVariants.length > 0 &&
          !isNewGameFromHistory(previousGameVariants, generated.content)
        ) {
          generated = await attemptLlm.generateStage({
            ...generationInput,
            revisionInstructions: [
              revisionInstructions,
              LESSON_GAME_RETRY_INSTRUCTION,
            ]
              .filter(Boolean)
              .join('\n'),
          });
        }
        if (type === LessonStageType.MEDITATION_OLDER)
          generated = await createOlderMeditation(
            attemptLlm,
            generationInput,
            generated,
          );
        if (type === LessonStageType.LESSON_VISUALS)
          generated = await this.correctStoryVisuals(
            lesson,
            generationInput,
            generated,
            attemptLlm,
          );
        let normalized = LESSON_DERIVED_VERSE_STAGES.includes(type)
          ? lockDerivedVerse(lesson, type, generated.content)
          : generated.content;
        normalized = validateCanonicalContent(
          lesson,
          type,
          normalized,
          visualConfig?.type,
        );
        if (
          isGameStage &&
          previousGameVariants.length > 0 &&
          !isNewGameFromHistory(previousGameVariants, normalized)
        )
          throw new ConflictException(
            'A IA repetiu a dinâmica anterior mesmo após uma nova tentativa. Gere novamente para obter uma brincadeira totalmente nova.',
          );
        if (visualConfig) {
          const assets = Array.isArray(normalized.assets)
            ? normalized.assets
            : [];
          if (assets.length !== visualConfig.quantity)
            throw new ConflictException(
              `A geração precisa retornar exatamente ${visualConfig.quantity} imagens.`,
            );
          normalized = { ...normalized, visualConfig };
        }
        throwIfGenerationAborted(signal);
        checkpoint = {
          upstreamChecksum,
          content: normalized,
          responseId: generated.responseId,
          usage: generated.usage,
          assetUrls: {},
        };
        await persistRequest({ ...request, checkpoint });
      }

      // The master image prompt is written once, before any image, and kept
      // in the checkpoint: a resumed attempt or a partial regeneration reuses
      // it word for word.
      const briefed = await this.imageBriefs.ensure(attemptLlm, {
        type,
        content: checkpoint.content,
        canonicalLesson: approvedLessonStage
          ? lessonCurrentContent(approvedLessonStage)
          : null,
        adminPrompt,
        generationInput,
        origin: imageBriefOriginOf(request),
      });
      throwIfGenerationAborted(signal);
      if (briefed !== checkpoint.content) {
        checkpoint = { ...checkpoint, content: briefed };
        await persistRequest({ ...request, checkpoint });
      }
      const textCheckpoint: LessonGenerationCheckpoint = checkpoint;
      const assetKey = lessonAssetListKey(type);
      const plannedAssets = Array.isArray(textCheckpoint.content[assetKey])
        ? (textCheckpoint.content[assetKey] as LessonJsonObject[])
        : [];
      const everyAssetStored = plannedAssets.every((asset) =>
        Boolean(textCheckpoint.assetUrls[String(asset.id)]),
      );
      // The older-meditation artwork is reviewed as a set: reuse all or none.
      const reusableAssetUrls =
        type === LessonStageType.MEDITATION_OLDER && !everyAssetStored
          ? {}
          : textCheckpoint.assetUrls;
      let completedImages = plannedAssets.filter((asset) =>
        Boolean(reusableAssetUrls[String(asset.id)]),
      ).length;
      await this.progress.advance(id, {
        phase:
          plannedAssets.length > 0
            ? LessonGenerationPhase.IMAGES
            : LessonGenerationPhase.SAVING,
        totalImages: plannedAssets.length,
        completedImages,
      });
      const olderImages =
        type === LessonStageType.MEDITATION_OLDER && !everyAssetStored
          ? await createOlderMeditationImages(
              attemptLlm,
              generationInput,
              textCheckpoint.content,
            )
          : undefined;
      let storedAssetUrls = { ...reusableAssetUrls };
      const content = await this.assets.generateAndStoreAssets(
        id,
        type,
        lesson,
        textCheckpoint.content,
        freshUploads,
        olderImages,
        attemptLlm,
        {
          assetUrls: reusableAssetUrls,
          signal,
          imageInstructions: request.imageInstructions,
          matchKeptImages: isImageRegeneration(request),
          onUploaded: async (assetId, url) => {
            unrecordedUploads.add(url);
            storedAssetUrls = { ...storedAssetUrls, [assetId]: url };
            await persistRequest({
              ...request,
              checkpoint: { ...textCheckpoint, assetUrls: storedAssetUrls },
              uploadedAssetUrls: [
                ...new Set([...(request.uploadedAssetUrls ?? []), url]),
              ],
            });
            unrecordedUploads.delete(url);
            completedImages += 1;
            await this.progress.advance(id, { completedImages });
          },
        },
      );
      throwIfGenerationAborted(signal);
      await this.progress.advance(id, { phase: LessonGenerationPhase.SAVING });

      const nextVersion =
        Math.max(
          0,
          ...(stage.versions ?? []).map((version) => version.versionNumber),
        ) + 1;
      const entity = this.repo.createVersion({
        stage: { id: stage.id } as LessonStageEntity,
        stageId: stage.id,
        versionNumber: nextVersion,
        structuredDataJson: content,
        tiptapAstJson: lessonContentToTiptap(
          content,
          type === LessonStageType.LESSON ? lesson.weekNumber : undefined,
          type,
          lesson.category,
        ),
        docxS3Key: null,
        pdfS3Key: null,
        changeSummary: isImageRegeneration(request)
          ? imageRegenerationSummary(
              request.regeneratedAssetIds?.length ?? 0,
              plannedAssets.length,
              attemptSnapshot.metadata,
            )
          : this.generationChangeSummary(
              attemptSnapshot.metadata,
              Boolean(revisionInstructions),
              textCheckpoint.usage,
            ),
        createdSource:
          nextVersion === 1
            ? LessonVersionSource.AI_GENERATED
            : LessonVersionSource.REGENERATION,
        createdById: userId,
        openAiResponseId: textCheckpoint.responseId || null,
        adminPromptSnapshot: adminPrompt,
        adminPromptChecksum: createHash('sha256')
          .update(adminPrompt)
          .digest('hex'),
        contentChecksum: lessonContentChecksum(content),
      });

      const trackedUploads = (): string[] => [
        ...new Set([...(request.uploadedAssetUrls ?? []), ...freshUploads]),
      ];
      let outcome: 'COMMITTED' | 'UPSTREAM_CHANGED' | 'NOT_OWNER' = 'NOT_OWNER';
      await this.repo.runInTransaction(async (manager) => {
        const locked = await this.repo.findLessonByIdForUpdate(id, manager);
        if (!locked) return;
        const lockedStage = locked.stages.find((item) => item.type === type);
        if (!lockedStage) return;

        if (
          lockedStage.status !== LessonStageStatus.GENERATING ||
          lockedStage.generationLeaseOwner !== attemptToken
        ) {
          this.logger.warn(
            `Tentativa ${attemptToken} não possui mais a posse da etapa ${type}. Abortando commit.`,
          );
          return;
        }

        // The locking query loads stages only; compare their persisted versions.
        const currentLesson = await this.repo.findLessonById(id, manager);
        if (!currentLesson) return;
        let currentUpstreamChecksum: string | null | undefined;
        try {
          const currentUpstream = assertLessonDependency(currentLesson, type);
          currentUpstreamChecksum = currentUpstream
            ? lessonContentChecksum(currentUpstream)
            : null;
        } catch (error: unknown) {
          if (!(error instanceof AppException)) throw error;
          // The previous item is no longer concluded: same as changed upstream.
          currentUpstreamChecksum = undefined;
        }
        if (upstreamChecksum !== currentUpstreamChecksum) {
          this.logger.warn(
            `Dependência upstream da etapa ${type} foi alterada durante o processamento. Abortando commit.`,
          );
          lockedStage.status = LessonStageStatus.FAILED;
          await this.repo.updateStage(
            lockedStage.id,
            {
              status: LessonStageStatus.FAILED,
              failureCode: LessonFailureCode.UPSTREAM_CHANGED,
              failureMessage:
                'O conteúdo da etapa anterior foi alterado durante a geração. Gere esta etapa novamente para usar o novo conteúdo.',
              generationRequestJson: null,
              generationRequestedById: null,
              generationLeaseOwner: null,
              generationLeaseUntil: null,
            },
            manager,
          );
          await this.support.syncLessonStatus(locked, manager);
          outcome = 'UPSTREAM_CHANGED';
          return;
        }

        const previousStatus =
          lockedStage.generationRequestJson?.previousState?.status;
        const version = await this.repo.saveVersion(entity, manager);
        lockedStage.currentVersionId = version.id;
        lockedStage.status = LessonStageStatus.DRAFT;
        await this.repo.updateStage(
          lockedStage.id,
          {
            currentVersionId: version.id,
            status: LessonStageStatus.DRAFT,
            failureCode: null,
            failureMessage: null,
            generationRequestJson: null,
            generationRequestedById: null,
            generationLeaseOwner: null,
            generationLeaseUntil: null,
          },
          manager,
        );
        await this.support.invalidateDownstream(
          locked,
          type,
          manager,
          previousStatus,
        );
        outcome = 'COMMITTED';
      });

      const finalOutcome = outcome as
        | 'COMMITTED'
        | 'UPSTREAM_CHANGED'
        | 'NOT_OWNER';
      if (finalOutcome === 'COMMITTED') {
        const kept = new Set(lessonContentAssetUrls(content));
        await this.support.discardUploads(
          trackedUploads().filter((url) => !kept.has(url)),
        );
      } else if (finalOutcome === 'UPSTREAM_CHANGED') {
        await this.support.discardUploads(trackedUploads());
      } else {
        // The current owner decides the fate of what the request recorded.
        await this.support.discardUploads([...unrecordedUploads]);
      }
    } catch (error: unknown) {
      // Recorded uploads belong to the request: its owner reuses or discards
      // them. Only what never reached the request is ours to remove.
      await this.support.discardUploads([...unrecordedUploads]);
      if (error instanceof LessonGenerationAbortedError) {
        this.logger.warn(
          `Tentativa ${attemptToken} da etapa ${type} interrompida (lease perdida ou encerramento).`,
        );
        return;
      }
      await this.failInterruptedGeneration(id, type, attemptToken, error);
    }
  }

  /**
   * Human-readable provenance of a generated version. There is no dedicated
   * column for provider, model and token usage, so they are recorded here.
   */
  private generationChangeSummary(
    metadata: LessonAttemptProviderMetadata | undefined,
    guidedByReview: boolean,
    usage?: LessonLlmUsage,
  ): string {
    const providerLabel =
      metadata?.provider === String(LessonLlmProvider.GEMINI)
        ? 'Gemini'
        : 'OpenAI';
    const model = usage?.model || metadata?.textModel;
    const details = [
      model,
      metadata?.imageModel ? `imagens: ${metadata.imageModel}` : undefined,
      usage?.totalTokens ? `${usage.totalTokens} tokens` : undefined,
    ].filter(Boolean);
    const summary = `${
      guidedByReview
        ? `Regeneração orientada por revisão via ${providerLabel}`
        : `Geração via ${providerLabel}`
    }${details.length ? ` (${details.join('; ')})` : ''}`;
    return summary.slice(0, LESSON_CHANGE_SUMMARY_MAX_LENGTH);
  }

  private async correctStoryVisuals(
    lesson: LessonEntity,
    input: LessonLlmGenerationInput,
    generated: LessonLlmGenerationResult,
    llmProvider: LessonLlmProviderContract,
  ): Promise<LessonLlmGenerationResult> {
    const sourceStage = lesson.stages.find(
      (stage) => stage.type === LessonStageType.LESSON,
    );
    const source = sourceStage ? lessonCurrentContent(sourceStage) : null;
    const story = lessonString(source?.story).trim();
    if (!story)
      throw new ConflictException(
        'A lição aprovada precisa conter a narrativa completa antes de gerar os visuais.',
      );
    let corrected = generated;
    for (let attempt = 0; ; attempt++) {
      try {
        validateCanonicalContent(
          lesson,
          LessonStageType.LESSON_VISUALS,
          corrected.content,
          input.visualConfig?.type,
        );
        const assets = Array.isArray(corrected.content.assets)
          ? corrected.content.assets
          : [];
        if (input.visualConfig && assets.length !== input.visualConfig.quantity)
          throw new ConflictException(
            `A geração precisa retornar exatamente ${input.visualConfig.quantity} imagens.`,
          );
        return corrected;
      } catch (error: unknown) {
        if (
          !(error instanceof ConflictException) ||
          attempt >= STORY_VISUAL_MAX_CORRECTIONS
        )
          throw error;
        corrected = await llmProvider.generateStage({
          ...input,
          revisionInstructions: [
            input.revisionInstructions,
            `Corrija especificamente este problema: ${error.message}`,
            input.visualConfig?.type === String(LessonVisualType.CUTOUT_KIT)
              ? CUTOUT_KIT_CORRECTION_INSTRUCTIONS
              : STORY_VISUAL_CORRECTION_INSTRUCTIONS,
            `NARRATIVA APROVADA COMPLETA:\n${story}`,
            `VERSÃO A CORRIGIR:\n${JSON.stringify(corrected.content)}`,
          ]
            .filter(Boolean)
            .join('\n'),
        });
      }
    }
  }
}
