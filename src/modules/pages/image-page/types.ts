import { IMAGE_PAGE_SORT_FIELDS } from './constants';

import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

/** Arquivos enviados, indexados pelo nome do campo multipart. */
export type MulterFilesDict = Record<string, Express.Multer.File>;

/** Mídias de uma galeria agrupadas por seção. */
export type MediaBySection = Map<string, MediaItemEntity[]>;

/** Campos da galeria persistidos pelos casos de uso. */
export interface ImagePageContent {
  name: string;
  description: string;
  public: boolean;
}

/** Diferença entre as seções persistidas e as enviadas pelo cliente. */
export interface SectionSyncPlan<TSection> {
  toRemove: string[];
  toUpdate: TSection[];
  toCreate: TSection[];
}

/** Campo pelo qual a listagem de galerias pode ser ordenada. */
export type ImagePageSortField = (typeof IMAGE_PAGE_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type ImagePageSortOrder = 'ASC' | 'DESC';

/** Uma celebração lida do banco, só com o que a resposta usa. */
export interface CelebrationRow {
  sectionId: string;
  userId: string;
  userName: string;
}

/** Celebrações agrupadas de uma seção. */
export interface CelebrationSummary {
  count: number;
  names: string[];
  celebratedByMe: boolean;
}
