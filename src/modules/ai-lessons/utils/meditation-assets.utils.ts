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
