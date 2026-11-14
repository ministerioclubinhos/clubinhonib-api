import { LessonSortField } from '../dto/query-lessons.dto';
import { LessonStatus } from '../enums/lesson.enums';

/** Allowlist of sortable columns of the lesson listing. */
export const LESSON_SORT_COLUMNS: Record<LessonSortField, string> = {
  [LessonSortField.CREATED_AT]: 'lesson.createdAt',
  [LessonSortField.UPDATED_AT]: 'lesson.updatedAt',
  [LessonSortField.THEME]: 'lesson.theme',
  [LessonSortField.WEEK_NUMBER]: 'lesson.weekNumber',
};

/** Asset URLs checked per aggregate query when looking for shared objects. */
export const LESSON_ASSET_REFERENCE_BATCH_SIZE = 40;

/** Most recently touched lessons shown in the Studio dashboard. */
export const LESSON_DASHBOARD_RECENT_LIMIT = 5;

/**
 * Statuses with nothing left to do in the Studio.
 *
 * Every other status is work in progress: the dashboard's work queue lists
 * those lessons so the next step of each one is one click away.
 */
export const LESSON_DASHBOARD_FINISHED_STATUSES: readonly LessonStatus[] = [
  LessonStatus.PUBLISHED,
  LessonStatus.ARCHIVED,
];

/** Lessons listed in the dashboard's work queue. */
export const LESSON_DASHBOARD_ACTIVE_LIMIT = 20;
