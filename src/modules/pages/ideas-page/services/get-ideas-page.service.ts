import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { IdeasPageResponseDto } from '../dto/ideas-page-response.dto';
import { IdeasPageSummaryDto } from '../dto/ideas-page-summary.dto';
import { QueryIdeasPagesDto } from '../dto/query-ideas-pages.dto';
import { toIdeasPageResponse, toIdeasPageSummary } from '../mappers';
import { collectSectionIds, groupMediaBySection } from '../utils';
import { MediaBySection } from '../types';
import {
  IDEAS_PAGES_DEFAULT_LIMIT,
  IDEAS_PAGES_DEFAULT_PAGE,
  IDEAS_SECTION_MEDIA_TARGET_TYPE,
} from '../constants';

@Injectable()
export class IdeasPageGetService {
  private readonly logger = new Logger(IdeasPageGetService.name);

  constructor(
    private readonly ideasPageRepository: IdeasPageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  /** Carrega a página com seções e rota, ou falha com o erro documentado. */
  async findEntityOrFail(id: string): Promise<IdeasPageEntity> {
    const page = await this.ideasPageRepository.findByIdWithSections(id);
    if (!page) {
      this.logger.warn(`Página de ideias não encontrada. ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Página de ideias não encontrada.',
      );
    }
    return page;
  }

  /**
   * Mídias das seções informadas, agrupadas por seção. As mídias apontam para a
   * seção (`IdeasSection`), nunca para a página.
   */
  async findMediaOfSections(sectionIds: string[]): Promise<MediaBySection> {
    if (sectionIds.length === 0) return new Map();

    const mediaItems =
      await this.mediaItemProcessor.findManyMediaItemsByTargets(
        sectionIds,
        IDEAS_SECTION_MEDIA_TARGET_TYPE,
      );

    return groupMediaBySection(mediaItems);
  }

  /**
   * Listagem paginada do painel: só o resumo de cada página.
   *
   * Uma página sem rota continua aparecendo, com `routePath` nulo — antes ela
   * era silenciosamente omitida, e o administrador não tinha como descobrir o
   * registro inconsistente para corrigi-lo.
   */
  async findAllPaginated(
    query: QueryIdeasPagesDto,
  ): Promise<Paginated<IdeasPageSummaryDto>> {
    const page = query.page ?? IDEAS_PAGES_DEFAULT_PAGE;
    const limit = query.limit ?? IDEAS_PAGES_DEFAULT_LIMIT;

    const { items, total } =
      await this.ideasPageRepository.findAllPaginated(query);

    return {
      data: items.map(toIdeasPageSummary),
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<IdeasPageResponseDto> {
    const page = await this.findEntityOrFail(id);
    const mediaBySection = await this.findMediaOfSections(
      collectSectionIds([page]),
    );

    return toIdeasPageResponse(page, mediaBySection);
  }

  /** Resposta recarregada do banco, usada após criar ou atualizar. */
  async buildResponse(pageId: string): Promise<IdeasPageResponseDto> {
    return this.findOne(pageId);
  }
}
