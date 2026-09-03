import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';

import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';
import { QueryIdeasSectionsDto } from '../dto/query-ideas-sections.dto';
import { IdeasSectionResponseDto } from '../dto/ideas-section-response.dto';
import { groupMediasBySection, toIdeasSectionResponse } from '../mappers';
import {
  IDEAS_SECTIONS_DEFAULT_LIMIT,
  IDEAS_SECTIONS_DEFAULT_PAGE,
} from '../constants';

/** Leitura das ideias compartilhadas pela base. */
@Injectable()
export class GetIdeasSectionsService {
  constructor(
    private readonly sectionsRepository: IdeasSectionsRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async findEntityOrFail(id: string): Promise<IdeasSectionEntity> {
    const section = await this.sectionsRepository.findById(id);

    if (!section) {
      throw new AppNotFoundException(
        ErrorCode.IDEA_NOT_FOUND,
        'Ideia compartilhada não encontrada',
      );
    }

    return section;
  }

  /** Fila da administração: ideias que ainda não foram publicadas. */
  async findPendingPaginated(
    query: QueryIdeasSectionsDto,
  ): Promise<Paginated<IdeasSectionResponseDto>> {
    const page = query.page ?? IDEAS_SECTIONS_DEFAULT_PAGE;
    const limit = query.limit ?? IDEAS_SECTIONS_DEFAULT_LIMIT;

    const { items, total } =
      await this.sectionsRepository.findPendingPaginated(query);

    // Uma consulta de mídias para a página inteira, e não uma por ideia.
    const medias = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      items.map((section) => section.id),
      MediaTargetType.IdeasSection,
    );
    const porSecao = groupMediasBySection(medias);

    const data = items.map((section) =>
      toIdeasSectionResponse(section, porSecao.get(section.id) ?? []),
    );

    return new Paginated(data, total, page, limit);
  }

  async findOne(id: string): Promise<IdeasSectionResponseDto> {
    const section = await this.findEntityOrFail(id);

    const medias = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      [section.id],
      MediaTargetType.IdeasSection,
    );

    return toIdeasSectionResponse(section, medias);
  }

  /** Quantas ideias aguardam decisão, para o aviso do painel. */
  async countPending(): Promise<{ pending: number }> {
    return { pending: await this.sectionsRepository.countPending() };
  }
}
