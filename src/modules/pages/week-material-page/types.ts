import { WEEK_MATERIAL_SORT_FIELDS } from './constants';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

/** Uploaded files indexed by their multipart field name. */
export type MulterFilesDict = Record<string, Express.Multer.File>;

/** Media payload of a create/update request, grouped by media type. */
export interface WeekMaterialMediaInput {
  videos?: MediaItemDto[];
  documents?: MediaItemDto[];
  images?: MediaItemDto[];
  audios?: MediaItemDto[];
}

/** Persisted media of a page, grouped by media type. */
export interface WeekMaterialMediaGroups {
  videos: MediaItemEntity[];
  documents: MediaItemEntity[];
  images: MediaItemEntity[];
  audios: MediaItemEntity[];
}

/** Result of diffing the persisted media against the media sent by the client. */
export interface WeekMaterialMediaSyncPlan {
  toRemove: MediaItemEntity[];
  toCreate: MediaItemDto[];
  toUpdate: MediaItemDto[];
}

/** Page fields persisted by the create and update use cases. */
export interface WeekMaterialPageContent {
  title: string;
  subtitle: string;
  description: string;
  currentWeek: boolean;
  sourceLessonId?: string | null;
}

/** Campo pelo qual a listagem pode ser ordenada. */
export type WeekMaterialSortField = (typeof WEEK_MATERIAL_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type WeekMaterialSortOrder = 'ASC' | 'DESC';

/** What a new page would be, for the search of pages that are the same thing. */
export interface WeekMaterialDuplicateCriteria {
  /** Title the new page will receive. */
  title: string;
  /** Week of a regular material; ignored for a special one. */
  weekNumber?: number | null;
  /** Material Especial: compared by title instead of by week. */
  special: boolean;
  /** Page that must never be reported (the caller's own page). */
  excludePageId?: string | null;
}

/** Existing page that looks like the same material. */
export interface WeekMaterialDuplicate {
  id: string;
  title: string;
  routePath: string | null;
}

/** Server-side choices of a creation; never bound to an HTTP body. */
export interface WeekMaterialCreateOptions {
  /**
   * Text the route `path` is derived from instead of the page title (for
   * example "Semana 27", so the path is `materiais_semanal_semana_27` while
   * the title stays "Semana 27 — tema").
   */
  routePathSource?: string;
}
