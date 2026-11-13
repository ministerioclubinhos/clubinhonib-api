import { FeedPhotoContextDto } from '../dto/feed-photo-context.dto';
import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionCelebrationsRepository } from '../repositories/image-section-celebrations.repository';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { ImagePageResponseDto } from '../dto/image-page-response.dto';
import { ImagePageSummaryDto } from '../dto/image-page-summary.dto';
import { QueryImagePagesDto } from '../dto/query-image-pages.dto';
import { PaginatedImageSectionResponseDto } from '../dto/paginated-image-section.dto';
import { QueryImageSectionsDto } from '../dto/query-image-sections.dto';
import {
  toImagePageResponse,
  toImagePageSummary,
  toPaginatedSectionsResponse,
} from '../mappers';
import {
  collectSectionIds,
  groupMediaBySection,
  summarizeCelebrations,
} from '../utils';
import { MediaBySection } from '../types';
import {
  IMAGE_PAGES_DEFAULT_LIMIT,
  IMAGE_PAGES_DEFAULT_PAGE,
  IMAGE_PAGE_ENTITY_TYPE,
} from '../constants';

@Injectable()
export class ImagePageGetService {
  private readonly logger = new Logger(ImagePageGetService.name);

  constructor(
    private readonly imagePageRepository: ImagePageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly celebrations: ImageSectionCelebrationsRepository,
  ) {}

  async findFeedPhotoContext(
    mediaId: string,
    pageId: string,
  ): Promise<FeedPhotoContextDto | null> {
    return this.imagePageRepository.findFeedPhotoContext(mediaId, pageId);
  }

  /** Carrega a galeria ou falha com o erro documentado. */
  async findEntityOrFail(id: string): Promise<ImagePageEntity> {
    const page = await this.imagePageRepository.findByIdWithSections(id);
    if (!page) {
      this.logger.warn(`Galeria não encontrada. ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Página de galeria não encontrada.',
      );
    }
    return page;
  }

  /**
   * A galeria pelo id, sem carregar as seções, ou `null` quando não existe.
   *
   * É o que outro módulo precisa para vincular uma seção a esta página: quem
   * decide o que fazer com a ausência é o chamador.
   */
  async findEntity(id: string): Promise<ImagePageEntity | null> {
    return this.imagePageRepository.findById(id);
  }

  /** Mídias das seções informadas, agrupadas por seção. */
  async findMediaOfSections(sectionIds: string[]): Promise<MediaBySection> {
    if (sectionIds.length === 0) return new Map();

    const mediaItems =
      await this.mediaItemProcessor.findManyMediaItemsByTargets(
        sectionIds,
        IMAGE_PAGE_ENTITY_TYPE,
      );

    return groupMediaBySection(mediaItems);
  }

  /**
   * Listagem paginada do painel: só o resumo de cada galeria.
   *
   * Uma galeria sem rota continua aparecendo, com `routePath` nulo — antes ela
   * era silenciosamente omitida, e o administrador não tinha como descobrir o
   * registro inconsistente para corrigi-lo.
   */
  async findAllPaginated(
    query: QueryImagePagesDto,
  ): Promise<Paginated<ImagePageSummaryDto>> {
    const page = query.page ?? IMAGE_PAGES_DEFAULT_PAGE;
    const limit = query.limit ?? IMAGE_PAGES_DEFAULT_LIMIT;

    const { items, total } =
      await this.imagePageRepository.findAllPaginated(query);

    return {
      data: items.map(toImagePageSummary),
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<ImagePageResponseDto> {
    const page = await this.findEntityOrFail(id);
    const mediaBySection = await this.findMediaOfSections(
      collectSectionIds([page]),
    );

    return toImagePageResponse(page, mediaBySection);
  }

  /**
   * Seções paginadas de uma galeria.
   *
   * `includePrivate` chega decidido pelo controller, que é quem enxerga a
   * requisição: o caso de uso só aplica a regra de visibilidade.
   */
  async findSectionsPaginated(
    pageId: string,
    query: QueryImageSectionsDto,
    includePrivate: boolean,
    currentUserId: string | null = null,
  ): Promise<PaginatedImageSectionResponseDto> {
    const page = await this.imagePageRepository.findById(pageId);
    if (!page) {
      this.logger.warn(`Galeria não encontrada. ID=${pageId}`);
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Página de galeria com ID ${pageId} não encontrada.`,
      );
    }

    const offset = (query.page - 1) * query.limit;
    const [sections, total] =
      await this.imagePageRepository.findSectionsPaginated(
        pageId,
        offset,
        query.limit,
        includePrivate,
      );

    const mediaBySection = await this.findMediaOfSections(
      sections.map((section) => section.id),
    );

    // Uma consulta para as celebrações da página inteira, e não uma por seção.
    const celebrations = summarizeCelebrations(
      await this.celebrations.findBySections(
        sections.map((section) => section.id),
      ),
      currentUserId,
    );
    const response = toPaginatedSectionsResponse(
      page,
      sections,
      mediaBySection,
      query.page,
      query.limit,
      total,
    );
    for (const item of response.sections) {
      const summary = celebrations.get(item.id);
      item.celebrationCount = summary?.count ?? 0;
      item.celebrators = summary?.names ?? [];
      item.celebratedByMe = summary?.celebratedByMe ?? false;
    }
    return response;
  }
}
