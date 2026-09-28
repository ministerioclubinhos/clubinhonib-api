import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { Interval } from '@nestjs/schedule';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { GenerateLessonRequestDto } from '../dto/generate-lesson-request.dto';
import { SaveTiptapContentDto } from '../dto/save-tiptap-content.dto';
import {
  LESSON_STAGE_ORDER,
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
  LessonVersionSource,
  LessonVisualOrientation,
  LessonVisualType,
} from '../enums/lesson.enums';
import { GenerateStageRequestDto } from '../dto/generate-stage-request.dto';
import {
  LESSON_TEMPLATES,
  templateChecksum,
} from '../templates/lesson-templates';
import { DocxExporterService } from './docx-exporter.service';
import { PdfLibreOfficeService } from './pdf-libreoffice.service';
import { WeekMaterialsPageCreateService } from 'src/modules/pages/week-material-page/services/create-week-material.service';
import { CreateWeekMaterialsPageDto } from 'src/modules/pages/week-material-page/dto/create-week-material.dto';
import {
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { AdminLessonPromptService } from './admin-lesson-prompt.service';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { QueryLessonsDto } from '../dto/query-lessons.dto';
import {
  buildGameInstructionImagePrompt,
  buildStoryVisualImagePrompt,
  extractTiptapSectionText,
  lessonString,
} from '../utils';
import { LESSON_LLM_PROVIDER } from '../providers/lesson-llm.constants';
import {
  LessonImageReference,
  LessonLlmProviderContract,
} from '../providers/lesson-llm.types';

type JsonObject = Record<string, unknown>;

@Injectable()
export class LessonDraftService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LessonDraftService.name);
  private readonly activeGenerations = new Set<string>();
  private readonly generationWorkerId = randomUUID();

  constructor(
    private readonly repo: AiLessonsRepository,
    @Inject(LESSON_LLM_PROVIDER)
    private readonly llm: LessonLlmProviderContract,
    private readonly s3: AwsS3Service,
    private readonly docx: DocxExporterService,
    private readonly pdf: PdfLibreOfficeService,
    private readonly weekMaterials: WeekMaterialsPageCreateService,
    private readonly adminPrompts: AdminLessonPromptService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.resumePendingGenerations();
  }

  @Interval(5000)
  async resumePendingGenerations(): Promise<void> {
    const interrupted = await this.repo.findGeneratingStages();
    for (const stage of interrupted) {
      if (!stage.generationRequestJson || !stage.generationRequestedById) {
        stage.status = LessonStageStatus.FAILED;
        stage.failureCode = 'GENERATION_REQUEST_MISSING';
        stage.failureMessage =
          'A geração interrompida não possuía dados para retomada. Tente novamente.';
        await this.repo.saveStage(stage);
        continue;
      }
      const claimed = await this.repo.claimGeneration(
        stage.id,
        this.generationWorkerId,
        this.nextGenerationLease(),
      );
      if (claimed) this.startGeneration(stage);
    }
  }

  async create(
    dto: GenerateLessonRequestDto,
    userId: string,
  ): Promise<LessonEntity> {
    const lesson = await this.repo.runInTransaction(async (manager) => {
      const created = await this.repo.saveLesson(
        this.repo.createLesson({
          theme: dto.theme.trim(),
          biblicalReference: dto.biblicalReference.trim(),
          weekNumber: dto.weekNumber,
          status: LessonStatus.DRAFT,
          createdById: userId,
          weekMaterialId: null,
        }),
        manager,
      );
      await this.repo.saveStages(
        LESSON_STAGE_ORDER.map((type) => {
          const template = LESSON_TEMPLATES[type];
          return this.repo.createStage({
            lessonId: created.id,
            type,
            status: LessonStageStatus.NOT_STARTED,
            currentVersionId: null,
            templateKey: template.key,
            templateVersion: template.version,
            templateChecksum: templateChecksum(template),
            failureCode: null,
            failureMessage: null,
            approvedAt: null,
            approvedById: null,
          });
        }),
        manager,
      );
      return created;
    });
    return this.getById(lesson.id);
  }

  async getDrafts(query: QueryLessonsDto): Promise<{
    items: LessonEntity[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const { items, total } = await this.repo.findDraftsPaginated(query);
    return {
      items,
      total,
      page: query.page,
      limit: query.limit,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getDashboard(): Promise<{
    total: number;
    byStatus: Record<LessonStatus, number>;
    recent: LessonEntity[];
  }> {
    const rows = await this.repo.getDashboardStatusCounts();
    const byStatus = Object.fromEntries(
      Object.values(LessonStatus).map((status) => [status, 0]),
    ) as Record<LessonStatus, number>;
    rows.forEach((row) => {
      byStatus[row.status] = Number(row.count);
    });
    const recent = await this.repo.findRecentLessons(5);
    return {
      total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
      byStatus,
      recent,
    };
  }

  async getById(id: string): Promise<LessonEntity> {
    const lesson = await this.repo.findLessonById(id);
    if (!lesson) throw new NotFoundException('Lição não encontrada.');
    lesson.stages.sort(
      (a, b) =>
        LESSON_STAGE_ORDER.indexOf(a.type) - LESSON_STAGE_ORDER.indexOf(b.type),
    );
    for (const stage of lesson.stages)
      stage.versions?.sort((a, b) => a.versionNumber - b.versionNumber);
    return lesson;
  }

  private currentContent(stage: LessonStageEntity): JsonObject | null {
    return (stage.versions?.find(
      (version) => version.id === stage.currentVersionId,
    )?.structuredDataJson ?? null) as JsonObject | null;
  }

  private assertDependency(
    lesson: LessonEntity,
    type: LessonStageType,
  ): JsonObject | null {
    const index = LESSON_STAGE_ORDER.indexOf(type);
    if (index === 0) return null;
    const dependency = lesson.stages.find(
      (stage) => stage.type === LESSON_STAGE_ORDER[index - 1],
    );
    const completedStatuses = [
      LessonStageStatus.PRODUCER_APPROVED,
      LessonStageStatus.IN_REVIEW,
      LessonStageStatus.APPROVED,
    ];
    if (!dependency || !completedStatuses.includes(dependency.status))
      throw new ConflictException(
        `A etapa ${LESSON_STAGE_ORDER[index - 1]} precisa ser concluída pelo produtor.`,
      );
    return Object.fromEntries(
      lesson.stages
        .filter(
          (stage) =>
            LESSON_STAGE_ORDER.indexOf(stage.type) < index &&
            completedStatuses.includes(stage.status),
        )
        .map((stage) => [stage.type, this.currentContent(stage)]),
    );
  }

  async generateStage(
    id: string,
    dto: GenerateStageRequestDto,
    userId: string,
  ): Promise<LessonEntity> {
    const { stage: type } = dto;
    const lesson = await this.repo.runInTransaction(async (manager) => {
      const lock = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!lock) throw new NotFoundException('Lição não encontrada.');
      const locked = await this.repo.findLessonById(id, manager);
      if (!locked) throw new NotFoundException('Lição não encontrada.');
      const lockedStage = locked.stages.find((item) => item.type === type);
      if (!lockedStage) throw new NotFoundException('Etapa não encontrada.');
      if (lockedStage.status === LessonStageStatus.GENERATING)
        throw new ConflictException('Esta etapa já está sendo gerada.');
      if (
        [
          LessonStatus.IN_REVIEW,
          LessonStatus.READY_FOR_PUBLICATION,
          LessonStatus.PUBLISHING,
          LessonStatus.PUBLISHED,
          LessonStatus.ARCHIVED,
        ].includes(locked.status)
      )
        throw new ConflictException(
          'A produção não pode ser regenerada durante ou depois da revisão final.',
        );
      this.assertDependency(locked, type);
      const activeTemplate = LESSON_TEMPLATES[type];
      lockedStage.templateKey = activeTemplate.key;
      lockedStage.templateVersion = activeTemplate.version;
      lockedStage.templateChecksum = templateChecksum(activeTemplate);
      lockedStage.status = LessonStageStatus.GENERATING;
      lockedStage.failureCode = null;
      lockedStage.failureMessage = null;
      lockedStage.generationRequestJson = dto;
      lockedStage.generationRequestedById = userId;
      lockedStage.generationLeaseOwner = null;
      lockedStage.generationLeaseUntil = null;
      await this.repo.saveStage(lockedStage, manager);
      return locked;
    });
    void this.resumePendingGenerations();
    return lesson;
  }

  private startGeneration(stage: LessonStageEntity): void {
    const key = `${stage.lessonId}:${stage.type}`;
    if (this.activeGenerations.has(key)) return;
    this.activeGenerations.add(key);
    const heartbeat = setInterval(() => {
      void this.repo.renewGenerationLease(
        stage.id,
        this.generationWorkerId,
        this.nextGenerationLease(),
      );
    }, 10000);
    void this.executeStageGeneration(
      stage.lessonId,
      stage.generationRequestJson!,
      stage.generationRequestedById!,
    )
      .catch((error: unknown) =>
        this.failInterruptedGeneration(stage.lessonId, stage.type, error),
      )
      .finally(() => {
        clearInterval(heartbeat);
        this.activeGenerations.delete(key);
      });
  }

  private nextGenerationLease(): Date {
    return new Date(Date.now() + 30000);
  }

  private async failInterruptedGeneration(
    lessonId: string,
    type: LessonStageType,
    error: unknown,
  ): Promise<void> {
    const lesson = await this.getById(lessonId);
    const stage = lesson.stages.find((item) => item.type === type);
    if (!stage || stage.status !== LessonStageStatus.GENERATING) return;
    stage.status = LessonStageStatus.FAILED;
    stage.failureCode = 'GENERATION_FAILED';
    stage.failureMessage = (
      error instanceof Error ? error.message : String(error)
    ).slice(0, 500);
    stage.generationRequestJson = null;
    stage.generationRequestedById = null;
    stage.generationLeaseOwner = null;
    stage.generationLeaseUntil = null;
    await this.repo.updateStage(stage.id, {
      status: stage.status,
      failureCode: stage.failureCode,
      failureMessage: stage.failureMessage,
      generationRequestJson: null,
      generationRequestedById: null,
      generationLeaseOwner: null,
      generationLeaseUntil: null,
    });
    this.logger.error(
      `Geração ${lessonId}:${type} falhou antes do processamento: ${stage.failureMessage}`,
    );
  }

  private async executeStageGeneration(
    id: string,
    dto: GenerateStageRequestDto,
    userId: string,
  ): Promise<void> {
    const { stage: type, revisionInstructions } = dto;
    const lesson = await this.getById(id);
    const stage = lesson.stages.find((item) => item.type === type)!;
    const upstream = this.assertDependency(lesson, type);
    const template = LESSON_TEMPLATES[type];
    const visualConfig =
      type === LessonStageType.LESSON_VISUALS
        ? this.validateVisualConfig(dto)
        : null;
    const uploadedUrls: string[] = [];
    try {
      const adminPrompt = await this.adminPrompts.effective(userId, type);
      const generated = await this.llm.generateStage({
        theme: lesson.theme,
        biblicalReference: lesson.biblicalReference,
        weekNumber: lesson.weekNumber,
        stage: type,
        template,
        approvedUpstream: upstream,
        adminPrompt,
        revisionInstructions,
        visualConfig,
      });
      const derivedVerseStages = [
        LessonStageType.VERSE_VISUALS,
        LessonStageType.VERSE_FIXATION,
        LessonStageType.MEDITATION_YOUNGER,
        LessonStageType.MEDITATION_OLDER,
        LessonStageType.MANUAL_WORK,
      ];
      let normalized = derivedVerseStages.includes(type)
        ? this.lockDerivedVerse(lesson, type, generated.content)
        : generated.content;
      normalized = this.validateCanonicalContent(lesson, type, normalized);
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
      const content = await this.generateAndStoreAssets(
        id,
        type,
        lesson,
        normalized,
        uploadedUrls,
      );
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
        tiptapAstJson: this.toTiptap(content),
        docxS3Key: null,
        pdfS3Key: null,
        changeSummary: revisionInstructions
          ? 'Regeneração orientada por revisão'
          : 'Geração via OpenAI',
        createdSource:
          nextVersion === 1
            ? LessonVersionSource.AI_GENERATED
            : LessonVersionSource.REGENERATION,
        createdById: userId,
        openAiResponseId: generated.responseId,
        adminPromptSnapshot: adminPrompt,
        adminPromptChecksum: createHash('sha256')
          .update(adminPrompt)
          .digest('hex'),
        contentChecksum: this.checksum(content),
      });
      const version = await this.repo.saveVersion(entity);
      stage.currentVersionId = version.id;
      stage.status = LessonStageStatus.DRAFT;
      stage.generationRequestJson = null;
      stage.generationRequestedById = null;
      stage.generationLeaseOwner = null;
      stage.generationLeaseUntil = null;
      await this.repo.updateStage(stage.id, {
        currentVersionId: version.id,
        status: LessonStageStatus.DRAFT,
        generationRequestJson: null,
        generationRequestedById: null,
        generationLeaseOwner: null,
        generationLeaseUntil: null,
      });
      await this.invalidateDownstream(lesson, type);
    } catch (error: unknown) {
      await Promise.all(uploadedUrls.map((url) => this.s3.delete(url)));
      stage.status = LessonStageStatus.FAILED;
      stage.failureCode = 'GENERATION_FAILED';
      stage.failureMessage = (
        error instanceof Error ? error.message : String(error)
      ).slice(0, 500);
      stage.generationRequestJson = null;
      stage.generationRequestedById = null;
      stage.generationLeaseOwner = null;
      stage.generationLeaseUntil = null;
      this.logger.error(
        `Geração ${id}:${type} falhou: ${stage.failureMessage}`,
      );
      await this.repo.updateStage(stage.id, {
        status: LessonStageStatus.FAILED,
        failureCode: stage.failureCode,
        failureMessage: stage.failureMessage,
        generationRequestJson: null,
        generationRequestedById: null,
        generationLeaseOwner: null,
        generationLeaseUntil: null,
      });
    }
  }

  private validateVisualConfig(dto: GenerateStageRequestDto): {
    type: LessonVisualType;
    orientation: LessonVisualOrientation;
    quantity: number;
  } {
    if (
      !dto.visualType ||
      !dto.visualOrientation ||
      !dto.visualQuantity ||
      !Number.isInteger(dto.visualQuantity) ||
      dto.visualQuantity < 4 ||
      dto.visualQuantity > 10
    )
      throw new BadRequestException(
        'Escolha o tipo pedagógico, a orientação e a quantidade de 4 a 10 imagens.',
      );
    return {
      type: dto.visualType,
      orientation: dto.visualOrientation,
      quantity: dto.visualQuantity,
    };
  }

  private async generateAndStoreAssets(
    lessonId: string,
    type: LessonStageType,
    lesson: LessonEntity,
    content: JsonObject,
    uploadedUrls: string[],
  ): Promise<JsonObject> {
    if (type === LessonStageType.LESSON) return content;
    const key = [
      LessonStageType.VERSE_VISUALS,
      LessonStageType.VERSE_FIXATION,
      LessonStageType.MEDITATION_YOUNGER,
      LessonStageType.MEDITATION_OLDER,
      LessonStageType.MANUAL_WORK,
    ].includes(type)
      ? 'printableAssets'
      : 'assets';
    const assets = Array.isArray(content[key])
      ? (content[key] as JsonObject[])
      : [];
    const visualConfig = this.asObject(content.visualConfig);
    const canonicalLesson =
      type === LessonStageType.LESSON_VISUALS
        ? this.currentContent(
            lesson.stages.find((item) => item.type === LessonStageType.LESSON)!,
          )
        : null;
    const completeStory = lessonString(canonicalLesson?.story).trim();
    if (type === LessonStageType.LESSON_VISUALS && !completeStory)
      throw new ConflictException(
        'A versão atual da lição precisa conter o tópico LIÇÃO BÍBLICA antes de gerar os visuais.',
      );
    const completed: JsonObject[] = [];
    let identityReferenceImage: LessonImageReference | undefined;
    for (const [assetIndex, asset] of assets.entries()) {
      const imagePrompt =
        type === LessonStageType.LESSON_VISUALS
          ? buildStoryVisualImagePrompt({
              completeStory,
              canonicalScene: {
                id: asset.id,
                sourceExcerpt: asset.sourceExcerpt,
                purpose: asset.purpose,
              },
              proposedComposition: lessonString(asset.prompt),
              hasIdentityReference: Boolean(identityReferenceImage),
            })
          : type === LessonStageType.STANDARD_GAME
            ? buildGameInstructionImagePrompt({
                game: content,
                stepNumber: Number(asset.stepNumber),
                instruction: lessonString(asset.instruction),
                proposedComposition: lessonString(asset.prompt),
              })
            : lessonString(asset.prompt);
      const buffer = await this.llm.generateImage(
        imagePrompt,
        lessonString(visualConfig.orientation),
        lessonString(visualConfig.type),
        identityReferenceImage,
      );
      const image = this.imageUploadMetadata(buffer);
      if (
        [
          LessonStageType.LESSON_VISUALS,
          LessonStageType.STANDARD_GAME,
        ].includes(type) &&
        assetIndex === 0
      )
        identityReferenceImage = {
          data: Buffer.from(buffer),
          mimeType: image.mimeType,
        };
      const originalname = `${lessonId}-${type}-${String(asset.id)}.${image.extension}`;
      const url = await this.s3.upload({
        buffer,
        originalname,
        mimetype: image.mimeType,
        size: buffer.length,
      } as Express.Multer.File);
      uploadedUrls.push(url);
      completed.push({
        ...asset,
        url,
        ...([
          LessonStageType.LESSON_VISUALS,
          LessonStageType.STANDARD_GAME,
        ].includes(type)
          ? { identityReference: assetIndex === 0 }
          : {}),
      });
    }
    return { ...content, [key]: completed };
  }

  private imageUploadMetadata(buffer: Buffer): {
    extension: 'jpg' | 'png';
    mimeType: 'image/jpeg' | 'image/png';
  } {
    const isJpeg =
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
    return isJpeg
      ? { extension: 'jpg', mimeType: 'image/jpeg' }
      : { extension: 'png', mimeType: 'image/png' };
  }

  private lockDerivedVerse(
    lesson: LessonEntity,
    type: LessonStageType,
    generated: JsonObject,
  ): JsonObject {
    const lessonStage = lesson.stages.find(
      (stage) => stage.type === LessonStageType.LESSON,
    );
    const approvedLesson = lessonStage
      ? this.currentContent(lessonStage)
      : null;
    const verse = this.asObject(approvedLesson?.memoryVerse);
    const text = lessonString(verse.text).trim();
    const reference = lessonString(verse.reference).trim();
    if (
      !text ||
      !reference ||
      lessonString(verse.version).toUpperCase() !== 'NVI'
    )
      throw new ConflictException(
        'A lição aprovada precisa ter um único versículo principal NVI antes da fixação.',
      );
    const assets = Array.isArray(generated.printableAssets)
      ? generated.printableAssets.map((item) => this.asObject(item))
      : [];
    if (type !== LessonStageType.VERSE_FIXATION && !assets.length)
      throw new ConflictException(
        'O material derivado precisa conter ao menos uma peça imprimível.',
      );
    if (type === LessonStageType.VERSE_VISUALS) {
      if (assets.length < 2 || assets.length > 10)
        throw new ConflictException(
          'Os visuais do versículo devem conter de uma a nove imagens de trechos e uma imagem final da referência.',
        );
      const normalize = (value: string): string =>
        value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR');
      const reconstructed = assets
        .slice(0, -1)
        .map((asset) => lessonString(asset.displayText).trim())
        .join(' ');
      if (normalize(reconstructed) !== normalize(text))
        throw new ConflictException(
          'A sequência visual não reconstrói exatamente o versículo NVI aprovado, na ordem correta.',
        );
      assets[assets.length - 1] = {
        ...assets[assets.length - 1],
        displayText: reference,
        purpose: 'Referência bíblica para encerrar a memorização',
      };
    }
    return {
      ...generated,
      verseText: text,
      verseReference: reference,
      verseVersion: 'NVI',
      printableAssets: assets,
    };
  }

  private validateCanonicalContent(
    lesson: LessonEntity,
    type: LessonStageType,
    generated: JsonObject,
  ): JsonObject {
    if (type === LessonStageType.LESSON) {
      generated.biblicalReference = lesson.biblicalReference;
      const themeUpper = (lesson.theme ?? '').trim().toUpperCase();
      const titleStr = lessonString(generated.title).trim();
      if (
        themeUpper &&
        (!titleStr || !titleStr.toUpperCase().includes(themeUpper))
      ) {
        generated.title = `LIÇÃO: ${themeUpper}`;
      }
      const verse = this.asObject(generated.memoryVerse);
      if (
        !lessonString(verse.text).trim() ||
        !lessonString(verse.reference).trim() ||
        lessonString(verse.version).trim().toUpperCase() !== 'NVI'
      ) {
        throw new ConflictException(
          'A lição precisa definir um único versículo principal, com texto, referência e versão NVI.',
        );
      }
      const scenes = Array.isArray(generated.visualScenes)
        ? generated.visualScenes.map((item) => this.asObject(item))
        : [];
      const sceneIds = scenes.map((scene) => lessonString(scene.id).trim());
      if (
        sceneIds.some((id) => !/^scene-\d{2}$/.test(id)) ||
        new Set(sceneIds).size !== sceneIds.length
      ) {
        throw new ConflictException(
          'As cenas da lição precisam usar IDs únicos no formato scene-01, scene-02 e assim por diante.',
        );
      }
    }

    if (type === LessonStageType.LESSON_VISUALS) {
      const sourceStage = lesson.stages.find(
        (stage) => stage.type === LessonStageType.LESSON,
      );
      const source = sourceStage ? this.currentContent(sourceStage) : null;
      const completeStory = lessonString(source?.story).trim();
      const assets = Array.isArray(generated.assets)
        ? generated.assets.map((item) => this.asObject(item))
        : [];
      const assetIds = assets.map((asset) => lessonString(asset.id).trim());
      if (
        assetIds.some(
          (id, index) => id !== `visual-${String(index + 1).padStart(2, '0')}`,
        ) ||
        new Set(assetIds).size !== assetIds.length
      ) {
        throw new ConflictException(
          'Os visuais da história precisam usar IDs sequenciais no formato visual-01, visual-02 e assim por diante.',
        );
      }
      const normalize = (value: string): string =>
        value.trim().replace(/\s+/g, ' ');
      const reconstructedStory = assets
        .map((asset) => lessonString(asset.sourceExcerpt).trim())
        .filter(Boolean)
        .join(' ');
      if (
        !completeStory ||
        assets.some((asset) => !lessonString(asset.sourceExcerpt).trim()) ||
        normalize(reconstructedStory) !== normalize(completeStory)
      )
        throw new ConflictException(
          'A IA precisa dividir toda a LIÇÃO BÍBLICA entre os visuais, na ordem, sem omitir, repetir ou reescrever trechos.',
        );
    }

    if (type === LessonStageType.STANDARD_GAME) {
      const steps = Array.isArray(generated.steps)
        ? generated.steps.map((step) => lessonString(step).trim())
        : [];
      const assets = Array.isArray(generated.assets)
        ? generated.assets.map((item) => this.asObject(item))
        : [];
      const invalid =
        !steps.length ||
        assets.length !== steps.length ||
        assets.some(
          (asset, index) =>
            lessonString(asset.id).trim() !==
              `instrucao-${String(index + 1).padStart(2, '0')}` ||
            Number(asset.stepNumber) !== index + 1 ||
            lessonString(asset.instruction).trim() !== steps[index],
        );
      if (invalid)
        throw new ConflictException(
          'A brincadeira precisa ter exatamente um visual instrucional para cada passo, na mesma ordem e com a instrução literal.',
        );
    }

    return generated;
  }

  private asObject(value: unknown): JsonObject {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as JsonObject)
      : {};
  }

  async saveContent(
    id: string,
    dto: SaveTiptapContentDto,
    userId: string,
  ): Promise<LessonEntity> {
    const lesson = await this.getById(id);
    const stage = lesson.stages.find((item) => item.type === dto.stage);
    if (!stage) throw new NotFoundException('Etapa não encontrada.');
    if (stage.lockVersion !== dto.lockVersion)
      throw new ConflictException(
        'Esta etapa foi alterada em outra sessão. Recarregue antes de salvar.',
      );
    if (
      ![
        LessonStageStatus.DRAFT,
        LessonStageStatus.PRODUCER_APPROVED,
        LessonStageStatus.CHANGES_REQUESTED,
        LessonStageStatus.STALE,
        LessonStageStatus.FAILED,
      ].includes(stage.status)
    )
      throw new ConflictException(
        'A etapa não está editável durante a revisão final.',
      );
    const nextVersion =
      Math.max(0, ...stage.versions.map((version) => version.versionNumber)) +
      1;
    let structured = dto.structuredDataJson ?? this.currentContent(stage) ?? {};
    if (dto.stage === LessonStageType.LESSON) {
      const editedStory = extractTiptapSectionText(
        dto.tiptapAstJson,
        'LIÇÃO BÍBLICA',
      );
      if (editedStory) structured = { ...structured, story: editedStory };
    }
    const entity = this.repo.createVersion({
      stage: { id: stage.id } as LessonStageEntity,
      stageId: stage.id,
      versionNumber: nextVersion,
      tiptapAstJson: dto.tiptapAstJson,
      structuredDataJson: structured,
      docxS3Key: null,
      pdfS3Key: null,
      changeSummary: dto.changeSummary ?? 'Edição manual',
      createdSource: LessonVersionSource.MANUAL_EDIT,
      createdById: userId,
      openAiResponseId: null,
      adminPromptSnapshot: null,
      adminPromptChecksum: null,
      contentChecksum: this.checksum(structured),
    });
    const version = await this.repo.saveVersion(entity);
    stage.currentVersionId = version.id;
    stage.status = LessonStageStatus.DRAFT;
    await this.repo.updateStage(stage.id, {
      currentVersionId: version.id,
      status: LessonStageStatus.DRAFT,
      failureCode: null,
      failureMessage: null,
    });
    await this.invalidateDownstream(lesson, dto.stage);
    return this.getById(id);
  }

  async completeProductionStage(
    id: string,
    type: LessonStageType,
  ): Promise<LessonEntity> {
    const lesson = await this.getById(id);
    const stage = lesson.stages.find((item) => item.type === type);
    if (!stage?.currentVersionId)
      throw new BadRequestException('Etapa sem conteúdo para concluir.');
    if (
      ![
        LessonStageStatus.DRAFT,
        LessonStageStatus.PRODUCER_APPROVED,
        LessonStageStatus.CHANGES_REQUESTED,
        LessonStageStatus.STALE,
        LessonStageStatus.FAILED,
      ].includes(stage.status)
    )
      throw new ConflictException(
        'Somente uma etapa em produção pode ser concluída.',
      );
    stage.status = LessonStageStatus.PRODUCER_APPROVED;
    stage.approvedAt = null;
    stage.approvedById = null;
    await this.repo.updateStage(stage.id, {
      status: LessonStageStatus.PRODUCER_APPROVED,
      approvedAt: null,
      approvedById: null,
      failureCode: null,
      failureMessage: null,
    });
    const allReady = lesson.stages.every(
      (item) =>
        item.id === stage.id ||
        [
          LessonStageStatus.PRODUCER_APPROVED,
          LessonStageStatus.APPROVED,
        ].includes(item.status),
    );
    lesson.status = allReady
      ? LessonStatus.PACKAGE_READY
      : LessonStatus.IN_PROGRESS;
    await this.repo.updateLesson(lesson.id, { status: lesson.status });
    return this.getById(id);
  }

  async submitPackageReview(id: string): Promise<LessonEntity> {
    const lesson = await this.getById(id);
    if (
      !lesson.stages.every((stage) =>
        [
          LessonStageStatus.PRODUCER_APPROVED,
          LessonStageStatus.APPROVED,
        ].includes(stage.status),
      )
    )
      throw new ConflictException(
        'Conclua todos os itens antes de submeter o pacote para aprovação final.',
      );
    for (const stage of lesson.stages.filter(
      (item) => item.status === LessonStageStatus.PRODUCER_APPROVED,
    )) {
      stage.status = LessonStageStatus.IN_REVIEW;
      await this.repo.saveStage(stage);
    }
    lesson.status = LessonStatus.IN_REVIEW;
    await this.repo.saveLesson(lesson);
    return this.getById(id);
  }

  async approveStage(
    id: string,
    type: LessonStageType,
    userId: string,
  ): Promise<LessonEntity> {
    const lesson = await this.getById(id);
    const stage = lesson.stages.find((item) => item.type === type);
    if (
      lesson.status !== LessonStatus.IN_REVIEW ||
      !stage ||
      stage.status !== LessonStageStatus.IN_REVIEW
    )
      throw new ConflictException(
        'Somente um item do pacote em revisão final pode ser aprovado.',
      );
    stage.status = LessonStageStatus.APPROVED;
    stage.approvedById = userId;
    stage.approvedAt = new Date();
    await this.repo.saveStage(stage);
    if (
      lesson.stages.every(
        (item) =>
          item.id === stage.id || item.status === LessonStageStatus.APPROVED,
      )
    ) {
      lesson.status = LessonStatus.READY_FOR_PUBLICATION;
      await this.repo.saveLesson(lesson);
    }
    return this.getById(id);
  }
  async requestChanges(
    id: string,
    type: LessonStageType,
  ): Promise<LessonEntity> {
    const lesson = await this.getById(id);
    const stage = lesson.stages.find((item) => item.type === type);
    if (
      lesson.status !== LessonStatus.IN_REVIEW ||
      !stage ||
      stage.status !== LessonStageStatus.IN_REVIEW
    )
      throw new ConflictException(
        'Somente um item do pacote em revisão final pode receber solicitação de ajustes.',
      );
    stage.status = LessonStageStatus.CHANGES_REQUESTED;
    await this.repo.saveStage(stage);
    for (const pending of lesson.stages.filter(
      (item) =>
        item.id !== stage.id && item.status === LessonStageStatus.IN_REVIEW,
    )) {
      pending.status = LessonStageStatus.PRODUCER_APPROVED;
      await this.repo.saveStage(pending);
    }
    lesson.status = LessonStatus.CHANGES_REQUESTED;
    await this.repo.saveLesson(lesson);
    return this.getById(id);
  }

  private async invalidateDownstream(
    lesson: LessonEntity,
    type: LessonStageType,
  ): Promise<void> {
    const index = LESSON_STAGE_ORDER.indexOf(type);
    for (const stage of lesson.stages.filter(
      (item) =>
        LESSON_STAGE_ORDER.indexOf(item.type) > index &&
        item.status !== LessonStageStatus.NOT_STARTED,
    )) {
      stage.status = LessonStageStatus.STALE;
      stage.approvedAt = null;
      stage.approvedById = null;
      await this.repo.updateStage(stage.id, {
        status: LessonStageStatus.STALE,
        approvedAt: null,
        approvedById: null,
      });
    }
    lesson.status = LessonStatus.IN_PROGRESS;
    await this.repo.updateLesson(lesson.id, {
      status: LessonStatus.IN_PROGRESS,
    });
  }

  async exportPdf(
    id: string,
  ): Promise<{ pdfBuffer: Buffer; fileName: string }> {
    const lesson = await this.getById(id);
    if (
      !lesson.stages.every(
        (stage) => stage.status === LessonStageStatus.APPROVED,
      )
    )
      throw new ConflictException(
        'Todas as etapas devem estar aprovadas antes da exportação.',
      );
    const content = Object.fromEntries(
      lesson.stages.map((stage) => {
        const version = stage.versions.find(
          (item) => item.id === stage.currentVersionId,
        );
        return [
          stage.type,
          {
            structuredDataJson: version?.structuredDataJson ?? {},
            tiptapAstJson: version?.tiptapAstJson ?? null,
          },
        ];
      }),
    );
    const docxBuffer =
      await this.docx.buildDocxFromTiptapOrStructuredJson(content);
    const pdfBuffer = await this.pdf.convertDocxToPdf(docxBuffer);
    return { pdfBuffer, fileName: `licao-semana-${lesson.weekNumber}.pdf` };
  }

  async previewStagePdf(
    id: string,
    type: LessonStageType,
  ): Promise<{ pdfBuffer: Buffer; fileName: string }> {
    const lesson = await this.getById(id);
    const stage = lesson.stages.find((item) => item.type === type);
    if (!stage?.currentVersionId)
      throw new BadRequestException(
        'Gere e salve o item antes de visualizar o PDF.',
      );
    const version = stage.versions.find(
      (item) => item.id === stage.currentVersionId,
    );
    if (!version)
      throw new NotFoundException('Versão atual do item não encontrada.');
    const input = {
      [type]: {
        structuredDataJson: version.structuredDataJson,
        tiptapAstJson: version.tiptapAstJson,
      },
    };
    const docxBuffer =
      await this.docx.buildDocxFromTiptapOrStructuredJson(input);
    const pdfBuffer = await this.pdf.convertDocxToPdf(docxBuffer);
    return {
      pdfBuffer,
      fileName: `preview-${type.toLowerCase()}-semana-${lesson.weekNumber}.pdf`,
    };
  }

  async publishToWeekMaterial(
    id: string,
  ): Promise<{ lesson: LessonEntity; weekMaterialId: string }> {
    const reservation = await this.repo.runInTransaction(async (manager) => {
      const locked = await this.repo.findLessonByIdForUpdate(id, manager);
      if (!locked) throw new NotFoundException('Lição não encontrada.');
      if (locked.status === LessonStatus.PUBLISHED && locked.weekMaterialId)
        return { publishedId: locked.weekMaterialId };
      if (locked.status === LessonStatus.PUBLISHING)
        throw new ConflictException(
          'A publicação desta lição já está em andamento.',
        );
      if (locked.status !== LessonStatus.READY_FOR_PUBLICATION)
        throw new ConflictException(
          'A produção ainda não possui todas as oito etapas aprovadas.',
        );
      locked.status = LessonStatus.PUBLISHING;
      await this.repo.saveLesson(locked, manager);
      return { publishedId: null };
    });
    if (reservation.publishedId)
      return {
        lesson: await this.getById(id),
        weekMaterialId: reservation.publishedId,
      };
    const lesson = await this.getById(id);
    const { pdfBuffer, fileName } = await this.exportPdf(id);
    const fieldKey = 'generatedLessonPdf';
    const dto = new CreateWeekMaterialsPageDto();
    dto.pageTitle = `Lição — ${lesson.theme}`;
    dto.pageSubtitle = lesson.biblicalReference;
    dto.pageDescription = `Material completo da semana ${lesson.weekNumber}, revisado e aprovado.`;
    dto.documents = [
      {
        title: `Lição completa — ${lesson.theme}`,
        description: lesson.biblicalReference,
        uploadType: UploadType.UPLOAD,
        mediaType: MediaType.DOCUMENT,
        isLocalFile: true,
        fieldKey,
        originalName: fileName,
        size: pdfBuffer.length,
      },
    ];
    const file = {
      fieldname: fieldKey,
      originalname: fileName,
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
      buffer: pdfBuffer,
    } as Express.Multer.File;
    let createdPageId: string | null = null;
    try {
      const page = await this.weekMaterials.createWeekMaterialsPage(dto, {
        [fieldKey]: file,
      });
      createdPageId = page.id;
      await this.repo.runInTransaction(async (manager) => {
        const locked = await this.repo.findLessonByIdForUpdate(id, manager);
        if (!locked) throw new NotFoundException('Lição não encontrada.');
        locked.status = LessonStatus.PUBLISHED;
        locked.weekMaterialId = page.id;
        await this.repo.saveLesson(locked, manager);
      });
      return { lesson: await this.getById(id), weekMaterialId: page.id };
    } catch (error: unknown) {
      await this.repo.runInTransaction(async (manager) => {
        const locked = await this.repo.findLessonByIdForUpdate(id, manager);
        if (
          !createdPageId &&
          locked?.status === LessonStatus.PUBLISHING &&
          !locked.weekMaterialId
        ) {
          locked.status = LessonStatus.READY_FOR_PUBLICATION;
          await this.repo.saveLesson(locked, manager);
        }
      });
      throw error;
    }
  }

  async delete(id: string): Promise<{ success: boolean; message: string }> {
    const lesson = await this.repo.findLessonById(id);

    if (!lesson) {
      throw new NotFoundException('Lição não encontrada.');
    }

    // Coleta e remove arquivos do S3 (PDFs, DOCXs e imagens geradas nas versões)
    const s3Urls = new Set<string>();
    for (const stage of lesson.stages || []) {
      for (const version of stage.versions || []) {
        if (version.docxS3Key) s3Urls.add(version.docxS3Key);
        if (version.pdfS3Key) s3Urls.add(version.pdfS3Key);
        if (version.structuredDataJson) {
          this.extractS3UrlsFromJson(version.structuredDataJson).forEach(
            (url) => s3Urls.add(url),
          );
        }
      }
    }

    // O banco é removido primeiro; falha no S3 deixa um órfão auditável, nunca uma lição quebrada.
    await this.repo.removeLesson(lesson);
    await Promise.all([...s3Urls].map((url) => this.s3.delete(url)));

    return {
      success: true,
      message:
        'Lição e todos os seus itens associados foram excluídos com sucesso.',
    };
  }

  private extractS3UrlsFromJson(obj: unknown): string[] {
    const urls: string[] = [];
    const findUrls = (val: unknown) => {
      if (typeof val === 'string') {
        if (val.includes('s3.amazonaws.com') || val.includes('.s3.')) {
          urls.push(val);
        }
      } else if (Array.isArray(val)) {
        val.forEach(findUrls);
      } else if (val && typeof val === 'object') {
        Object.values(val as Record<string, unknown>).forEach(findUrls);
      }
    };
    findUrls(obj);
    return urls;
  }

  private checksum(value: JsonObject): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }
  private toTiptap(value: JsonObject): JsonObject {
    const nodes: JsonObject[] = [];
    const labels: Record<string, string> = {
      title: 'TÍTULO',
      biblicalReference: 'TEXTO BÍBLICO',
      purpose: 'PROPÓSITO',
      songs: 'MÚSICAS',
      memoryVerse: 'VERSÍCULO PARA MEMORIZAR',
      text: 'TEXTO DO VERSÍCULO',
      reference: 'REFERÊNCIA',
      version: 'VERSÃO',
      principleExplanation: 'EXPLICAÇÃO DO PRINCÍPIO',
      story: 'LIÇÃO BÍBLICA',
      applicationAndAppeal: 'APLICAÇÃO E APELO',
      counseling: 'ACONSELHAMENTO / CANTINHO DO ACONSELHAMENTO',
      reviewQuestions: 'PERGUNTAS DA LIÇÃO',
      question: 'PERGUNTA',
      answer: 'RESPOSTA',
      closingPrayer: 'FALANDO COM DEUS',
      name: 'NOME',
      objective: 'OBJETIVO',
      materials: 'MATERIAIS',
      preparation: 'PREPARAÇÃO',
      steps: 'PASSO A PASSO',
      rulesAndSafety: 'REGRAS E SEGURANÇA',
      biblicalPrinciple: 'PRINCÍPIO BÍBLICO',
      verseText: 'TEXTO DO VERSÍCULO',
      verseReference: 'REFERÊNCIA DO VERSÍCULO',
      verseVersion: 'VERSÃO BÍBLICA',
      splitRationale: 'CRITÉRIO DA DIVISÃO',
      durationMinutes: 'DURAÇÃO EM MINUTOS',
      ageAdaptations: 'ADAPTAÇÕES POR IDADE',
      evaluation: 'COMO AVALIAR',
      ageGroup: 'FAIXA ETÁRIA',
      biblicalText: 'TEXTO BÍBLICO',
      introduction: 'ENTENDENDO A LIÇÃO',
      activities: 'ATIVIDADES',
      instruction: 'INSTRUÇÃO',
      prayer: 'FALANDO COM DEUS',
      printLayout: 'FORMATO DE IMPRESSÃO',
    };
    const label = (key: string): string =>
      labels[key] ??
      key
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .toLocaleUpperCase('pt-BR');
    const paragraph = (text: string): JsonObject => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    });
    const blockquote = (text: string): JsonObject => ({
      type: 'blockquote',
      content: [paragraph(text)],
    });
    const append = (key: string, raw: unknown, depth = 2): void => {
      if (
        ['assets', 'printableAssets', 'visualScenes', 'visualConfig'].includes(
          key,
        )
      )
        return;
      if (key === 'title') {
        const titleText = lessonString(raw).trim();
        if (titleText) {
          nodes.push({
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: titleText }],
          });
        }
        return;
      }
      nodes.push({
        type: 'heading',
        attrs: { level: Math.min(depth, 3) },
        content: [{ type: 'text', text: label(key) }],
      });
      if (key === 'memoryVerse' && raw && typeof raw === 'object') {
        const verseObj = raw as JsonObject;
        const text = lessonString(verseObj.text).trim();
        const reference = lessonString(verseObj.reference).trim();
        if (text) {
          nodes.push(paragraph(`"${text}"`));
        }
        if (reference) {
          nodes.push(paragraph(reference));
        }
        return;
      }
      if (
        typeof raw === 'string' ||
        typeof raw === 'number' ||
        typeof raw === 'boolean'
      ) {
        const textStr = String(raw).trim();
        const normalizedText = textStr.replace(
          /(?:\s+)?(scene-\d{1,2}:[^\n.?]+(?:\.|\?|(?=\s+scene-|\n|$)))/gi,
          '\n\n$1\n\n',
        );
        const lines = normalizedText
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);

        if (lines.length === 0) {
          nodes.push(paragraph(textStr));
          return;
        }

        for (const line of lines) {
          if (/^(scene-\d+|cena-\d+|\[scene|\[cena)/i.test(line)) {
            const cleanLine = line
              .replace(/^(?:\[?\s*(?:scene|cena)[-\s_]*\d+\s*\]?:?|-?)\s*/i, '')
              .trim();
            nodes.push(blockquote(cleanLine || line));
          } else {
            nodes.push(paragraph(line));
          }
        }
        return;
      }
      if (Array.isArray(raw)) {
        const stringItems = raw
          .filter((item): item is string => typeof item === 'string')
          .map((s) => s.trim())
          .filter(Boolean);

        if (stringItems.length > 0 && stringItems.length === raw.length) {
          nodes.push({
            type: 'bulletList',
            content: stringItems.map((str) => ({
              type: 'listItem',
              content: [paragraph(str)],
            })),
          });
          return;
        }

        raw.forEach((item, index) => {
          if (typeof item === 'string')
            nodes.push({
              type: 'bulletList',
              content: [{ type: 'listItem', content: [paragraph(item)] }],
            });
          else if (item && typeof item === 'object') {
            const entry = item as JsonObject;
            const question = lessonString(entry.question).trim();
            const answer = lessonString(entry.answer).trim();
            if (question || answer) {
              nodes.push(paragraph(`${index + 1}. ${question}`));
              if (answer) nodes.push(paragraph(`Resposta: ${answer}`));
            } else {
              nodes.push({
                type: 'heading',
                attrs: { level: 3 },
                content: [{ type: 'text', text: `ATIVIDADE ${index + 1}` }],
              });
              Object.entries(entry)
                .filter(([childKey]) => childKey !== 'number')
                .forEach(([childKey, child]) => append(childKey, child, 3));
            }
          }
        });
        return;
      }
      if (raw && typeof raw === 'object')
        Object.entries(raw as JsonObject).forEach(([childKey, child]) =>
          append(childKey, child, 3),
        );
    };
    Object.entries(value).forEach(([key, raw]) => append(key, raw));
    return { type: 'doc', content: nodes };
  }
}
