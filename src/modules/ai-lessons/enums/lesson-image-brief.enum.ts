/** Why the image brief of a version was (re)built. */
export enum LessonImageBriefOrigin {
  /** Written together with a full generation of the item. */
  GENERATION = 'GENERATION',
  /** Every image was regenerated, so the brief was written again. */
  ALL_IMAGES = 'ALL_IMAGES',
  /** The version had no usable brief when some images were regenerated. */
  BACKFILL = 'BACKFILL',
}
