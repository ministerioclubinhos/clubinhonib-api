import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

/** Arquivos enviados, indexados pelo nome do campo multipart. */
export type MulterFilesDict = Record<string, Express.Multer.File>;

/** Mídias de uma página agrupadas por seção. */
export type MediaBySection = Map<string, MediaItemEntity[]>;

/** Campos da página persistidos pelos casos de uso. */
export interface IdeasPageContent {
  title: string;
  subtitle: string;
  description: string;
  public: boolean;
}

/** Campos da seção persistidos pelos casos de uso. */
export interface IdeasSectionContent {
  title: string;
  description: string;
  public: boolean;
}

/** Diferença entre as seções persistidas e as enviadas pelo cliente. */
export interface SectionSyncPlan<TSection> {
  toRemove: string[];
  toUpdate: TSection[];
  toCreate: TSection[];
}
