import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { ImagePageRepository } from '../repositories/image-page.repository';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImagePageResponseDto } from '../dto/image-page-response.dto';
import { PaginatedImageSectionResponseDto } from '../dto/paginated-image-section.dto';
import { QueryImageSectionsDto } from '../dto/query-image-sections.dto';
import {
  hasRoute,
  toImagePageResponse,
  toPaginatedSectionsResponse,
} from '../mappers';
import { collectSectionIds, groupMediaBySection } from '../utils';
import { MediaBySection } from '../types';
import { IMAGE_PAGE_ENTITY_TYPE } from '../constants';

@Injectable()
export class ImagePageGetService {
  private readonly logger = new Logger(ImagePageGetService.name);

  constructor(
    private readonly imagePageRepository: ImagePageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

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

  async findAll(): Promise<ImagePageResponseDto[]> {
    const allPages = await this.imagePageRepository.findAllWithSections();

    // Uma galeria sem rota não pode ser representada no contrato. Ela é omitida
    // da listagem, com registro, para que um dado inconsistente não derrube a
    // lista inteira do administrador.
    const pages = allPages.filter((page) => {
      if (hasRoute(page)) return true;
      this.logger.warn(
        `Galeria sem rota associada, omitida da listagem. ID=${page.id}`,
      );
      return false;
    });

    if (pages.length === 0) return [];

    const mediaBySection = await this.findMediaOfSections(
      collectSectionIds(pages),
    );

    return pages.map((page) => toImagePageResponse(page, mediaBySection));
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

    return toPaginatedSectionsResponse(
      page,
      sections,
      mediaBySection,
      query.page,
      query.limit,
      total,
    );
  }
}
