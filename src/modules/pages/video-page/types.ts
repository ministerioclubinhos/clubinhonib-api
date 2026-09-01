import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

/** Arquivos enviados, indexados pelo nome do campo multipart. */
export type MulterFilesDict = Record<string, Express.Multer.File>;

/** Campos da página persistidos pelos casos de uso. */
export interface VideoPageContent {
  name: string;
  description: string;
  public: boolean;
}

/** Diferença entre os vídeos persistidos e os enviados pelo cliente. */
export interface VideoSyncPlan {
  toRemove: MediaItemEntity[];
  toUpdate: MediaItemDto[];
  toCreate: MediaItemDto[];
}
