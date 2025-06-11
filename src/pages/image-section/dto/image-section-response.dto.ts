import { ImageSectionEntity } from 'src/pages/image-page/entity/Image-section.entity';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { MediaItemDto } from 'src/share/share-dto/media-item-dto';

export class ImageSectionResponseDto {
  id: string;
  caption: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  mediaItems: MediaItemDto[];

  static fromEntity(section: ImageSectionEntity, mediaItems: MediaItemEntity[]): ImageSectionResponseDto {
    return {
      id: section.id,
      caption: section.caption,
      description: section.description,
      public: section.public,
      createdAt: section.createdAt,
      updatedAt: section.updatedAt,
      mediaItems: mediaItems.map((item) => ({
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
      })),
    };
  }
}
