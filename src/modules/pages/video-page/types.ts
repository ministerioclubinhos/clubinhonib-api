import { VIDEO_PAGE_SORT_FIELDS } from './constants';

import { PlayScope } from 'src/modules/play/enums/play-scope.enum';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

/** Arquivos enviados, indexados pelo nome do campo multipart. */
export type MulterFilesDict = Record<string, Express.Multer.File>;

/** Campos da página persistidos pelos casos de uso. */
export interface VideoPageContent {
  name: string;
  description: string;
  public: boolean;
  /** Ausente = mantém o modo atual. */
  playScope?: PlayScope;
  playCategoryId?: string | null;
}

/** Diferença entre os vídeos persistidos e os enviados pelo cliente. */
export interface VideoSyncPlan {
  toRemove: MediaItemEntity[];
  toUpdate: MediaItemDto[];
  toCreate: MediaItemDto[];
}

/** Campo pelo qual a listagem de páginas de vídeos pode ser ordenada. */
export type VideoPageSortField = (typeof VIDEO_PAGE_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type VideoPageSortOrder = 'ASC' | 'DESC';
