import {
  MISSING_ACTIVITY_ART,
  VISUAL_ACTIVITY_REFERENCE,
} from '../constants/meditation-prompts.constants';
import type { MeditationJson } from '../types/younger-meditation.types';

export function meditationActivityAsset(
  assets: unknown[],
  index: number,
  activityCount: number,
): MeditationJson {
  const objects = assets.filter(
    (asset): asset is MeditationJson =>
      Boolean(asset) && typeof asset === 'object' && !Array.isArray(asset),
  );
  return (
    objects.find(
      (asset) =>
        Number(String(asset.id).match(/(?:^|[-_])([1-3])$/)?.[1]) === index + 1,
    ) ??
    (objects.length === activityCount ? objects[index] : undefined) ??
    {}
  );
}

/**
 * Younger meditation: the first activity always has art and any other one
 * whose command depends on pictures gets its art planned, so the sheet never
 * prints "figuras abaixo" next to an empty column.
 */
export function withMissingActivityArt(
  content: MeditationJson,
): MeditationJson {
  const activities = Array.isArray(content.activities)
    ? (content.activities as unknown[])
    : [];
  const assets = Array.isArray(content.printableAssets)
    ? [...(content.printableAssets as unknown[])]
    : [];
  activities.forEach((raw, index) => {
    const activity =
      raw && typeof raw === 'object' ? (raw as MeditationJson) : {};
    const instruction =
      typeof activity.instruction === 'string' ? activity.instruction : '';
    // The first activity always has art; the second only when it needs one
    // (a written multiple choice keeps all its options in the command).
    if (index > 0 && !VISUAL_ACTIVITY_REFERENCE.test(instruction)) return;
    if (
      Object.keys(meditationActivityAsset(assets, index, activities.length))
        .length
    )
      return;
    assets.push({ id: String(index + 1), ...MISSING_ACTIVITY_ART });
  });
  return assets.length ===
    (Array.isArray(content.printableAssets)
      ? content.printableAssets.length
      : 0)
    ? content
    : { ...content, printableAssets: assets };
}
