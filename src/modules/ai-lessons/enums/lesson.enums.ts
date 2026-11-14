export enum LessonStatus {
  DRAFT = 'DRAFT',
  IN_PROGRESS = 'IN_PROGRESS',
  PACKAGE_READY = 'PACKAGE_READY',
  IN_REVIEW = 'IN_REVIEW',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  READY_FOR_PUBLICATION = 'READY_FOR_PUBLICATION',
  PUBLISHING = 'PUBLISHING',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum LessonStageType {
  LESSON = 'LESSON',
  LESSON_VISUALS = 'LESSON_VISUALS',
  STANDARD_GAME = 'STANDARD_GAME',
  VERSE_VISUALS = 'VERSE_VISUALS',
  VERSE_FIXATION = 'VERSE_FIXATION',
  MEDITATION_YOUNGER = 'MEDITATION_YOUNGER',
  MEDITATION_OLDER = 'MEDITATION_OLDER',
  MANUAL_WORK = 'MANUAL_WORK',
}

export const LESSON_STAGE_ORDER: readonly LessonStageType[] = [
  LessonStageType.LESSON,
  LessonStageType.LESSON_VISUALS,
  LessonStageType.STANDARD_GAME,
  LessonStageType.VERSE_VISUALS,
  LessonStageType.VERSE_FIXATION,
  LessonStageType.MEDITATION_YOUNGER,
  LessonStageType.MEDITATION_OLDER,
  LessonStageType.MANUAL_WORK,
];

export enum LessonCategory {
  REGULAR = 'REGULAR', // Material Semanal (8 itens)
  SPECIAL = 'SPECIAL', // Material Especial (3 itens: Lição, Visual da Lição, Visual do Versículo)
}

export const SPECIAL_LESSON_STAGE_ORDER: readonly LessonStageType[] = [
  LessonStageType.LESSON,
  LessonStageType.LESSON_VISUALS,
  LessonStageType.VERSE_VISUALS,
];

export function getLessonStageOrder(
  category?: LessonCategory | null,
): readonly LessonStageType[] {
  return category === LessonCategory.SPECIAL
    ? SPECIAL_LESSON_STAGE_ORDER
    : LESSON_STAGE_ORDER;
}

export enum LessonStageStatus {
  NOT_STARTED = 'NOT_STARTED',
  GENERATING = 'GENERATING',
  DRAFT = 'DRAFT',
  PRODUCER_APPROVED = 'PRODUCER_APPROVED',
  IN_REVIEW = 'IN_REVIEW',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  APPROVED = 'APPROVED',
  FAILED = 'FAILED',
  STALE = 'STALE',
}

export enum LessonVersionSource {
  AI_GENERATED = 'AI_GENERATED',
  MANUAL_EDIT = 'MANUAL_EDIT',
  REGENERATION = 'REGENERATION',
}

export enum LessonVisualType {
  CUTOUT_KIT = 'CUTOUT_KIT',
  STORY_SEQUENCE = 'STORY_SEQUENCE',
  CHARACTER_AND_EMOTION = 'CHARACTER_AND_EMOTION',
  VISUAL_ANCHORS = 'VISUAL_ANCHORS',
  INTERACTIVE_COLORING = 'INTERACTIVE_COLORING',
}

/** Drawing style of the story visuals, independent of the format (kit or scenes). */
export enum LessonVisualStyle {
  /** Cute cartoon for young children (big heads and eyes, bright colours): the default. */
  CUTE_CARTOON = 'CUTE_CARTOON',
  /** Soft children's-book painting: the style used before styles could be chosen. */
  ILLUSTRATED = 'ILLUSTRATED',
  /** Bold black outline and flat colours, like the manual kits of the archive. */
  CLASSIC_CARTOON = 'CLASSIC_CARTOON',
}

export enum CutoutCategory {
  CHARACTERS = 'CHARACTERS',
  ANIMALS = 'ANIMALS',
  BUILDINGS = 'BUILDINGS',
  SCENERY = 'SCENERY',
  SKY_AND_NATURE = 'SKY_AND_NATURE',
  OBJECTS = 'OBJECTS',
}

export enum LessonVisualOrientation {
  LANDSCAPE = 'LANDSCAPE',
  PORTRAIT = 'PORTRAIT',
}
