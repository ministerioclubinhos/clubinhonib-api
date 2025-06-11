import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import { ImageSectionDto } from './image-page-response.dto';
import { ImagePageEntity } from '../entity/Image-page.entity';

export class PaginatedImageSectionResponseDto {
  id: string;
  title: string;
  description: string;
  public: boolean;
  createdAt: Date;
  updatedAt: Date;
  sections: ImageSectionDto[];
  page: number;
  limit: number;
  total: number;

  static fromEntities(
    pageEntity: ImagePageEntity,
    sections: ImageSectionEntity[],
    mediaMap: Map<string, MediaItemEntity[]>,
    page: number,
    limit: number,
    total: number,
  ): PaginatedImageSectionResponseDto {
    return {
      id: pageEntity.id,
      title: pageEntity.name,
      description: pageEntity.description,
      public: pageEntity.public,
      createdAt: pageEntity.createdAt,
      updatedAt: pageEntity.updatedAt,

      sections: sections.map((section) =>
        ImageSectionDto.fromEntity(section, mediaMap.get(section.id) || []),
      ),
      page,
      limit,
      total,
    };
  }
}
