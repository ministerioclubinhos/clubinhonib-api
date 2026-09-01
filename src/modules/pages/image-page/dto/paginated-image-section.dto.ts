import { ImageSectionDto } from './image-page-response.dto';

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
}
