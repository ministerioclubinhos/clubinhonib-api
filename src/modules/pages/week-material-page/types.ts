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
}
