import { IdeasSectionEntity } from 'src/pages/ideas-page/entities/ideas-section.entity';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class IdeasSectionResponseDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  medias: MediaItemDto[];

  static fromEntity(section: IdeasSectionEntity, medias: MediaItemEntity[]): IdeasSectionResponseDto {
    return {
      id: section.id,
      title: section.title,
      description: section.description,
      public: section.public,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
      medias: medias.map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        uploadType: item.uploadType,
        mediaType: item.mediaType,
        isLocalFile: item.isLocalFile,
        url: item.url,
        platformType: item.platformType,
        originalName: item.originalName,
        size: item.size,
        fieldKey: undefined,
      })),
    };
  }
}
