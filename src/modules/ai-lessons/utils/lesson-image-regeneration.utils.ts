import { LEGACY_LESSON_VISUAL_STYLE } from '../constants/lesson-visual-style.constants';
import { resolveLessonVisualStyle } from './story-visual-mode.utils';
import { LessonImageBriefOrigin } from '../enums/lesson-image-brief.enum';
import {
  AppBusinessException,
  AppConflictException,
  ErrorCode,
} from 'src/shared/exceptions';
import { LESSON_CHANGE_SUMMARY_MAX_LENGTH } from '../constants/lesson-workflow.constants';
import {
  LessonLlmProvider,
  type LessonAttemptProviderMetadata,
} from '../providers/lesson-llm.types';
import {
  LESSON_IMAGE_REGENERATION,
  LESSON_IMAGE_SET_STAGES,
} from '../constants/lesson-image-regeneration.constants';
import { LessonStageType } from '../enums/lesson.enums';
import type {
  LessonGenerationRequest,
  LessonJsonObject,
} from '../types/lesson-generation.types';
import type { LessonImageRegenerationPlan } from '../types/lesson-image-regeneration.types';
import { lessonAsObject } from './lesson-workflow.utils';
import { lessonAssetListKey } from './lesson-studio-errors.utils';

const invalid = (message: string): AppBusinessException =>
  new AppBusinessException(ErrorCode.LESSON_INVALID_REQUEST, message);

/**
 * Splits the images of the current version into kept and regenerated. Every
 * refusal is an input error answered at request time, never a failed job.
 */
export function planImageRegeneration(
  type: LessonStageType,
  content: LessonJsonObject | null,
  requestedIds: readonly string[],
): LessonImageRegenerationPlan {
  if (type === LessonStageType.LESSON)
    throw invalid('Este item não possui imagens.');
  const list = content?.[lessonAssetListKey(type)];
  const assets = (Array.isArray(list) ? list : []).map((item) =>
    lessonAsObject(item),
  );
  if (assets.length === 0)
    throw invalid(
      'Este item ainda não possui imagens. Gere o item antes de regerar imagens.',
    );
  const urlById = new Map<string, string>();
  for (const asset of assets) {
    const url = typeof asset.url === 'string' ? asset.url.trim() : '';
    if (!url)
      throw invalid(
        'Há imagens que ainda não foram geradas neste item. Gere o item novamente por completo.',
      );
    urlById.set(String(asset.id), url);
  }
  if (urlById.size !== assets.length)
    throw invalid(
      'As imagens deste item têm identificadores repetidos. Gere o item novamente por completo.',
    );
  const requested = new Set(requestedIds.map((id) => id.trim()));
  const unknown = [...requested].filter((id) => !urlById.has(id));
  if (requested.size === 0 || unknown.length > 0)
    throw invalid(
      'Alguma imagem escolhida não existe mais neste item. Recarregue a página e escolha novamente.',
    );
  if (
    LESSON_IMAGE_SET_STAGES.includes(type) &&
    requested.size !== assets.length
  )
    throw invalid(
      'As imagens deste item são produzidas e conferidas em conjunto: só é possível regerar todas.',
    );
  const keptAssetUrls: Record<string, string> = {};
  const regeneratedAssetIds: string[] = [];
  for (const [id, url] of urlById) {
    if (requested.has(id)) regeneratedAssetIds.push(id);
    else keptAssetUrls[id] = url;
  }
  return { keptAssetUrls, regeneratedAssetIds, totalImages: assets.length };
}

/** The visual choices of the version in use, so the new images match it. */
export function visualChoicesOfContent(
  content: LessonJsonObject | null,
): Pick<
  LessonGenerationRequest,
  'visualType' | 'visualOrientation' | 'visualQuantity' | 'visualStyle'
> {
  const config = lessonAsObject(content?.visualConfig);
  return {
    visualType: config.type as LessonGenerationRequest['visualType'],
    visualOrientation:
      config.orientation as LessonGenerationRequest['visualOrientation'],
    visualQuantity:
      typeof config.quantity === 'number' ? config.quantity : undefined,
    // Versions made before styles existed keep the style they were drawn in.
    visualStyle: resolveLessonVisualStyle(
      config.style,
      LEGACY_LESSON_VISUAL_STYLE,
    ),
  };
}

/** Appends the administrator's note to the prompt of a regenerated image. */
export function withImageInstructions(
  prompt: string,
  instructions: string | undefined,
): string {
  const note = instructions?.trim();
  return note
    ? `${prompt}\n\n${LESSON_IMAGE_REGENERATION.INSTRUCTIONS_HEADING}\n${note}`
    : prompt;
}

export function isImageRegeneration(
  request: Pick<LessonGenerationRequest, 'regeneratedAssetIds'>,
): boolean {
  return (request.regeneratedAssetIds ?? []).length > 0;
}

export function imageSelectionOutdated(): AppConflictException {
  return new AppConflictException(
    ErrorCode.LESSON_STAGE_LOCK_CONFLICT,
    'Este item foi alterado em outra sessão. Recarregue antes de regerar as imagens.',
  );
}

/** Provenance of a version whose text was kept and only images were redone. */
export function imageRegenerationSummary(
  regenerated: number,
  total: number,
  metadata: LessonAttemptProviderMetadata | undefined,
): string {
  const provider =
    metadata?.provider === String(LessonLlmProvider.GEMINI)
      ? 'Gemini'
      : 'OpenAI';
  const scope =
    regenerated >= total
      ? `Todas as ${total} imagens regeradas`
      : `${regenerated} de ${total} ${regenerated === 1 ? 'imagem regerada' : 'imagens regeradas'}`;
  const model = metadata?.imageModel ? ` (${metadata.imageModel})` : '';
  return `${scope} via ${provider}${model}; texto mantido`.slice(
    0,
    LESSON_CHANGE_SUMMARY_MAX_LENGTH,
  );
}

/**
 * Which kept images guide a replacement: the image that set the identity of
 * the set (the first one) when it stays, then the closest neighbours.
 */
export function keptReferenceIds(
  orderedIds: readonly string[],
  targetId: string,
  keptIds: ReadonlySet<string>,
  max: number = LESSON_IMAGE_REGENERATION.MAX_REFERENCE_IMAGES,
): string[] {
  const target = orderedIds.indexOf(targetId);
  const byDistance = orderedIds
    .map((id, index) => ({ id, distance: Math.abs(index - target), index }))
    .filter((item) => keptIds.has(item.id) && item.id !== targetId)
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
    .map((item) => item.id);
  const first = orderedIds[0];
  const ordered =
    first !== undefined && keptIds.has(first) && first !== targetId
      ? [first, ...byDistance.filter((id) => id !== first)]
      : byDistance;
  return ordered.slice(0, Math.max(0, max));
}

/** Tells the image model the new image must match the ones that stay. */
export function withStyleContinuity(prompt: string): string {
  return `${prompt}\n\n${LESSON_IMAGE_REGENERATION.STYLE_CONTINUITY}`;
}

export function regeneratesEveryImage(
  plan: Pick<LessonImageRegenerationPlan, 'keptAssetUrls'>,
): boolean {
  return Object.keys(plan.keptAssetUrls).length === 0;
}

/** Why a brief written during this request exists. */
export function imageBriefOriginOf(
  request: Pick<LessonGenerationRequest, 'regeneratedAssetIds' | 'checkpoint'>,
): LessonImageBriefOrigin {
  if (!isImageRegeneration(request)) return LessonImageBriefOrigin.GENERATION;
  return Object.keys(request.checkpoint?.assetUrls ?? {}).length === 0
    ? LessonImageBriefOrigin.ALL_IMAGES
    : LessonImageBriefOrigin.BACKFILL;
}
