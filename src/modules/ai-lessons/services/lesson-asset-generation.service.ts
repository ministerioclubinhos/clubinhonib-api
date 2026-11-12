import { withLessonVisualStyle } from '../utils/story-visual-mode.utils';
import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import {
  LESSON_GAME_STAGES,
  LESSON_GENERATED_IMAGE_MAX_BYTES,
  LESSON_IDENTITY_REFERENCE_STAGES,
  LESSON_MEDITATION_STAGES,
} from '../constants/lesson-workflow.constants';
import { LessonEntity } from '../entities/lesson.entity';
import {
  LessonCategory,
  LessonStageType,
  LessonVisualType,
} from '../enums/lesson.enums';
import {
  LessonImagePurpose,
  LessonImageReference,
  LessonLlmProviderContract,
} from '../providers/lesson-llm.types';
import type {
  LessonAssetCheckpointHooks,
  LessonJsonObject,
} from '../types/lesson-generation.types';
import {
  buildCutoutKitImagePrompt,
  buildGameInstructionImagePrompt,
  buildStoryVisualImagePrompt,
  buildVerseVisualImagePrompt,
  lessonString,
} from '../utils';
import { cutoutKitGenerationOrder } from '../utils/cutout-kit.utils';
import { attachOwnedAssetUrls } from '../utils/lesson-asset-ownership.utils';
import {
  assertLessonUploadImage,
  lessonUploadImageMetadata,
} from '../utils/lesson-upload-image.utils';
import {
  lessonAsObject,
  lessonCurrentContent,
} from '../utils/lesson-workflow.utils';
import {
  keptReferenceIds,
  withImageInstructions,
  withStyleContinuity,
} from '../utils/lesson-image-regeneration.utils';
import {
  imageBriefPart,
  readImageBrief,
  withImageBriefPart,
} from '../utils/lesson-image-brief.utils';
import { buildManualWorkImagePrompt } from '../utils/manual-work-image.utils';
import { buildMeditationActivityImagePrompt } from '../utils/meditation-image.utils';
import {
  lessonAssetListKey,
  throwIfGenerationAborted,
} from '../utils/lesson-studio-errors.utils';

/** Generates, validates and stores the artwork of a stage, reusing uploads checkpointed by an interrupted attempt. */
@Injectable()
export class LessonAssetGenerationService {
  private readonly logger = new Logger(LessonAssetGenerationService.name);

  constructor(private readonly s3: AwsS3Service) {}

  async generateAndStoreAssets(
    lessonId: string,
    type: LessonStageType,
    lesson: LessonEntity,
    content: LessonJsonObject,
    uploadedUrls: string[],
    preparedImages: Map<string, Buffer> | undefined,
    llmProvider: LessonLlmProviderContract,
    hooks?: LessonAssetCheckpointHooks,
  ): Promise<LessonJsonObject> {
    if (type === LessonStageType.LESSON) return content;
    const key = lessonAssetListKey(type);
    const assets = Array.isArray(content[key])
      ? (content[key] as LessonJsonObject[])
      : [];
    const visualConfig = lessonAsObject(content.visualConfig);
    const lessonStage = lesson.stages.find(
      (item) => item.type === LessonStageType.LESSON,
    );
    const canonicalLesson =
      lessonStage &&
      [LessonStageType.LESSON_VISUALS, LessonStageType.VERSE_VISUALS].includes(
        type,
      )
        ? lessonCurrentContent(lessonStage)
        : null;
    const completeStory = lessonString(canonicalLesson?.story).trim();
    if (type === LessonStageType.LESSON_VISUALS && !completeStory)
      throw new ConflictException(
        'A versão atual da lição precisa conter o tópico LIÇÃO BÍBLICA antes de gerar os visuais.',
      );
    const usesIdentityReference =
      LESSON_IDENTITY_REFERENCE_STAGES.includes(type);
    let identityReferenceImage: LessonImageReference | undefined;
    const isCutoutKit =
      type === LessonStageType.LESSON_VISUALS &&
      visualConfig.type === LessonVisualType.CUTOUT_KIT;
    const generationOrder = isCutoutKit
      ? cutoutKitGenerationOrder(assets)
      : assets.map((_, index) => index);
    const reusable = hooks?.assetUrls ?? {};
    const pendingCount = assets.filter(
      (asset) => !reusable[String(asset.id)],
    ).length;
    const completedByIndex = new Map<number, LessonJsonObject>();
    const usedUrls: string[] = [];
    // The master prompt of the version: reused as stored, never rewritten here.
    const brief = readImageBrief(type, content);
    // Replacing some images of a set that stays in use: each new image is
    // generated against the kept ones, whatever the stage.
    const matchKept = Boolean(hooks?.matchKeptImages) && pendingCount > 0;
    const orderedIds = generationOrder.map((index) => String(assets[index].id));
    const keptIds = new Set(orderedIds.filter((id) => Boolean(reusable[id])));
    const storedReferences = new Map<
      string,
      Promise<LessonImageReference | undefined>
    >();
    const keptReference = async (
      targetId: string,
    ): Promise<LessonImageReference | undefined> => {
      const files: LessonImageReference[] = [];
      for (const id of keptReferenceIds(orderedIds, targetId, keptIds)) {
        const url = reusable[id];
        if (!storedReferences.has(url))
          storedReferences.set(url, this.storedIdentityReference(url));
        const file = await storedReferences.get(url);
        if (file) files.push(file);
      }
      const [main, ...companions] = files;
      return main ? { ...main, companions } : undefined;
    };
    for (const [position, assetIndex] of generationOrder.entries()) {
      throwIfGenerationAborted(hooks?.signal);
      const asset = assets[assetIndex];
      const assetId = String(asset.id);
      const identityFlag = usesIdentityReference
        ? { identityReference: position === 0 }
        : {};
      let reusedUrl: string | undefined = reusable[assetId];
      if (
        reusedUrl &&
        usesIdentityReference &&
        position === 0 &&
        pendingCount > 0 &&
        // A kept image is never redone, even when it cannot be read back.
        !matchKept
      ) {
        // Later images still need the identity reference of the stored one.
        identityReferenceImage = await this.storedIdentityReference(reusedUrl);
        if (!identityReferenceImage) {
          this.logger.warn(
            `Imagem de identidade ${assetId} não pôde ser reutilizada; será gerada novamente.`,
          );
          reusedUrl = undefined;
        }
      }
      if (reusedUrl) {
        usedUrls.push(reusedUrl);
        completedByIndex.set(assetIndex, {
          ...asset,
          url: reusedUrl,
          ...identityFlag,
        });
        continue;
      }
      const prepared = preparedImages?.get(assetId);
      const continuity =
        matchKept && !prepared ? await keptReference(assetId) : undefined;
      if (matchKept && !prepared && !continuity)
        this.logger.warn(
          `Imagem ${assetId} será regerada sem referência das imagens mantidas (nenhuma pôde ser lida).`,
        );
      const part = imageBriefPart(brief, assetId);
      // A cutout sheet without characters gains nothing from a reference image
      // and loses a lot: the model redraws the reference's elements on it.
      const referenceAllowed = !(isCutoutKit && part && part.cast.length === 0);
      const reference = referenceAllowed
        ? (continuity ?? identityReferenceImage)
        : undefined;
      const basePrompt = this.assetImagePrompt({
        type,
        lesson,
        content,
        asset,
        assetIndex,
        isCutoutKit,
        completeStory,
        canonicalLesson,
        hasIdentityReference: Boolean(reference),
      });
      const buffer =
        prepared ??
        (await this.generateAssetImage(
          llmProvider,
          withImageInstructions(
            continuity && reference
              ? withStyleContinuity(
                  withImageBriefPart(basePrompt, brief, assetId),
                )
              : withImageBriefPart(basePrompt, brief, assetId),
            hooks?.imageInstructions,
          ),
          type,
          lesson,
          visualConfig,
          isCutoutKit,
          reference,
          Boolean(continuity && reference),
        ));
      const image = assertLessonUploadImage(buffer);
      if (usesIdentityReference && position === 0)
        identityReferenceImage = {
          data: Buffer.from(buffer),
          mimeType: image.mimeType,
        };
      const originalname = `${lessonId}-${type}-${assetId}.${image.extension}`;
      const url = await this.s3.upload({
        buffer,
        originalname,
        mimetype: image.mimeType,
        size: buffer.length,
      } as Express.Multer.File);
      uploadedUrls.push(url);
      usedUrls.push(url);
      if (hooks) await hooks.onUploaded(assetId, url);
      completedByIndex.set(assetIndex, { ...asset, url, ...identityFlag });
    }
    const completed: LessonJsonObject[] = [];
    for (const index of assets.keys()) {
      const item = completedByIndex.get(index);
      if (item) completed.push(item);
    }
    return attachOwnedAssetUrls({ ...content, [key]: completed }, usedUrls);
  }

  /** A stored image as identity reference; undefined when it cannot be read. */
  private async storedIdentityReference(
    url: string,
  ): Promise<LessonImageReference | undefined> {
    try {
      const stored = await this.s3.downloadOwned(
        url,
        LESSON_GENERATED_IMAGE_MAX_BYTES,
      );
      return {
        data: stored,
        mimeType: lessonUploadImageMetadata(stored).mimeType,
      };
    } catch (error: unknown) {
      this.logger.warn(
        `Imagem de referência não pôde ser lida: ${String(error)}`,
      );
      return undefined;
    }
  }

  private assetImagePrompt(params: {
    type: LessonStageType;
    lesson: LessonEntity;
    content: LessonJsonObject;
    asset: LessonJsonObject;
    assetIndex: number;
    isCutoutKit: boolean;
    completeStory: string;
    canonicalLesson: LessonJsonObject | null;
    hasIdentityReference: boolean;
  }): string {
    const { type, lesson, content, asset, assetIndex, completeStory } = params;
    if (params.isCutoutKit)
      return buildCutoutKitImagePrompt({
        category: lessonString(asset.category),
        title: lessonString(asset.title),
        items: Array.isArray(asset.items)
          ? (asset.items as LessonJsonObject[])
          : [],
        layoutPlan: lessonString(asset.layoutPlan),
        proposedComposition: lessonString(asset.prompt),
        hasIdentityReference: params.hasIdentityReference,
      });
    if (type === LessonStageType.LESSON_VISUALS)
      return buildStoryVisualImagePrompt({
        category: lesson.category,
        completeStory,
        canonicalScene: {
          id: asset.id,
          sourceExcerpt: asset.sourceExcerpt,
          purpose: asset.purpose,
        },
        proposedComposition: lessonString(asset.prompt),
        hasIdentityReference: params.hasIdentityReference,
      });
    if (LESSON_GAME_STAGES.includes(type))
      return buildGameInstructionImagePrompt({
        game: content,
        stepNumber: Number(asset.stepNumber),
        instruction: lessonString(asset.instruction),
        proposedComposition: lessonString(asset.prompt),
      });
    if (type === LessonStageType.VERSE_VISUALS) {
      const verse = lessonAsObject(params.canonicalLesson?.memoryVerse);
      return buildVerseVisualImagePrompt({
        fullVerse: lessonString(verse.text),
        verseReference: lessonString(verse.reference),
        displayText: lessonString(asset.displayText),
        proposedComposition: lessonString(asset.prompt),
      });
    }
    if (LESSON_MEDITATION_STAGES.includes(type)) {
      const activity = lessonAsObject(
        Array.isArray(content.activities)
          ? content.activities[(Number(asset.id) || assetIndex + 1) - 1]
          : {},
      );
      return buildMeditationActivityImagePrompt(
        type === LessonStageType.MEDITATION_YOUNGER
          ? '5 a 7 anos'
          : '8 a 11 anos',
        lessonString(activity.instruction),
        lessonString(asset.prompt),
        lessonString(activity.answer),
      );
    }
    if (type === LessonStageType.MANUAL_WORK)
      return buildManualWorkImagePrompt(lessonString(asset.prompt));
    return lessonString(asset.prompt);
  }

  private generateAssetImage(
    llmProvider: LessonLlmProviderContract,
    imagePrompt: string,
    type: LessonStageType,
    lesson: LessonEntity,
    visualConfig: LessonJsonObject,
    isCutoutKit: boolean,
    identityReferenceImage: LessonImageReference | undefined,
    /** A replacement always carries its references, whatever the stage. */
    forceReference = false,
  ): Promise<Buffer> {
    const orientation = lessonString(visualConfig.orientation);
    const visualType = lessonString(visualConfig.type);
    if (type === LessonStageType.LESSON_VISUALS)
      imagePrompt = withLessonVisualStyle(imagePrompt, visualConfig.style);
    if (isCutoutKit)
      return llmProvider.generateImage(
        imagePrompt,
        orientation,
        visualType,
        identityReferenceImage,
        LessonImagePurpose.CUTOUT_SHEET,
      );
    if (LESSON_MEDITATION_STAGES.includes(type))
      return llmProvider.generateImage(
        imagePrompt,
        orientation,
        visualType,
        identityReferenceImage,
        LessonImagePurpose.MEDITATION_ACTIVITY,
      );
    if (type === LessonStageType.MANUAL_WORK)
      return llmProvider.generateImage(
        imagePrompt,
        orientation,
        visualType,
        forceReference ? identityReferenceImage : undefined,
        LessonImagePurpose.MANUAL_COLORING,
      );
    if (lesson.category === LessonCategory.SPECIAL)
      return llmProvider.generateImage(
        imagePrompt,
        orientation,
        visualType,
        identityReferenceImage,
        undefined,
        { category: LessonCategory.SPECIAL },
      );
    return llmProvider.generateImage(
      imagePrompt,
      orientation,
      visualType,
      identityReferenceImage,
    );
  }
}
