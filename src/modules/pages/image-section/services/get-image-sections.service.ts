import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';

import { ImageSectionsRepository } from '../repositories/image-sections.repository';
import { QueryImageSectionsDto } from '../dto/query-image-sections.dto';
import { ImageSectionResponseDto } from '../dto/image-section-response.dto';
import { groupMediasBySection, toImageSectionResponse } from '../mappers';
import {
  IMAGE_SECTIONS_DEFAULT_LIMIT,
  IMAGE_SECTIONS_DEFAULT_PAGE,
} from '../constants';

/** Leitura das fotos enviadas pelos clubinhos. */
@Injectable()
export class GetImageSectionsService {
  constructor(
    private readonly sectionsRepository: ImageSectionsRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async findEntityOrFail(id: string): Promise<ImageSectionEntity> {
    const section = await this.sectionsRepository.findById(id);

    if (!section) {
      throw new AppNotFoundException(
        ErrorCode.IMAGE_NOT_FOUND,
        'Publicação de fotos não encontrada',
      );
    }

    return section;
  }

  async findAllPaginated(
    query: QueryImageSectionsDto,
  ): Promise<Paginated<ImageSectionResponseDto>> {
    const page = query.page ?? IMAGE_SECTIONS_DEFAULT_PAGE;
    const limit = query.limit ?? IMAGE_SECTIONS_DEFAULT_LIMIT;

    const { items, total } =
      await this.sectionsRepository.findAllPaginated(query);

    // Uma consulta de mídias para a página inteira, e não uma por seção.
    const medias = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      items.map((section) => section.id),
      MediaTargetType.ImagesPage,
    );
    const porSecao = groupMediasBySection(medias);

    const data = items.map((section) =>
      toImageSectionResponse(section, porSecao.get(section.id) ?? []),
    );

    return new Paginated(data, total, page, limit);
  }

  async findOne(id: string): Promise<ImageSectionResponseDto> {
    const section = await this.findEntityOrFail(id);

    const medias = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      [section.id],
      MediaTargetType.ImagesPage,
    );

    return toImageSectionResponse(section, medias);
  }

  /** Quantas fotos aguardam aprovação, para o aviso do painel. */
  async countPending(): Promise<{ pending: number }> {
    return { pending: await this.sectionsRepository.countPending() };
  }
}
