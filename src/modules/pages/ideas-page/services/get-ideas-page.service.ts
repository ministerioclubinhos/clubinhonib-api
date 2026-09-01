import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasPageResponseDto } from '../dto/ideas-page-response.dto';
import { hasRoute, toIdeasPageResponse } from '../mappers';
import { collectSectionIds, groupMediaBySection } from '../utils';
import { MediaBySection } from '../types';
import { IDEAS_SECTION_MEDIA_TARGET_TYPE } from '../constants';

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

  async findAll(): Promise<IdeasPageResponseDto[]> {
    const allPages = await this.ideasPageRepository.findAllWithSections();

    // Uma página sem rota não pode ser representada no contrato. Ela é omitida
    // da listagem, com registro, para que um dado inconsistente não derrube a
    // lista inteira do administrador.
    const pages = allPages.filter((page) => {
      if (hasRoute(page)) return true;
      this.logger.warn(
        `Página de ideias sem rota associada, omitida da listagem. ID=${page.id}`,
      );
      return false;
    });

    if (pages.length === 0) return [];

    const mediaBySection = await this.findMediaOfSections(
      collectSectionIds(pages),
    );

    return pages.map((page) => toIdeasPageResponse(page, mediaBySection));
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
