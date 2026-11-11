import { LessonSortField } from '../dto/query-lessons.dto';

/** Allowlist of sortable columns of the lesson listing. */
export const LESSON_SORT_COLUMNS: Record<LessonSortField, string> = {
  [LessonSortField.CREATED_AT]: 'lesson.createdAt',
  [LessonSortField.UPDATED_AT]: 'lesson.updatedAt',
  [LessonSortField.THEME]: 'lesson.theme',
  [LessonSortField.WEEK_NUMBER]: 'lesson.weekNumber',
};

/** Asset URLs checked per aggregate query when looking for shared objects. */
export const LESSON_ASSET_REFERENCE_BATCH_SIZE = 40;
