import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { WeekMaterialsPageRepository } from '../repositories/week-material-page.repository';
import { WeekMaterialsPageResponseDTO } from '../dto/week-material-response.dto';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { hasRoute, toWeekMaterialsPageResponse } from '../mappers';
import { WEEK_MATERIAL_ENTITY_TYPE } from '../constants';

@Injectable()
export class WeekMaterialsPageGetService {
  private readonly logger = new Logger(WeekMaterialsPageGetService.name);

  constructor(
    private readonly pageRepo: WeekMaterialsPageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  /** Loads a page or fails with the documented not-found error. */
  async findOnePage(id: string): Promise<WeekMaterialsPageEntity> {
    const page = await this.pageRepo.findOnePageById(id);
    if (!page) {
      this.logger.warn(`Página de materiais não encontrada. ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.WEEK_MATERIAL_NOT_FOUND,
        'Página não encontrada',
      );
    }
    return page;
  }

  /** Loads every media item attached to a page. */
  async findMediaOfPage(pageId: string): Promise<MediaItemEntity[]> {
    return this.mediaItemProcessor.findMediaItemsByTarget(
      pageId,
      WEEK_MATERIAL_ENTITY_TYPE,
    );
  }

  async findPageWithMedia(id: string): Promise<WeekMaterialsPageResponseDTO> {
    const page = await this.findOnePage(id);
    const mediaItems = await this.findMediaOfPage(page.id);
    return toWeekMaterialsPageResponse(page, mediaItems);
  }

  async findAllPagesWithMedia(): Promise<WeekMaterialsPageResponseDTO[]> {
    const allPages = await this.pageRepo.findAllPages();

    // Uma página sem rota não pode ser representada no contrato. Ela é omitida
    // da listagem, com registro, para que um dado inconsistente não derrube a
    // lista inteira do administrador.
    const pages = allPages.filter((page) => {
      if (hasRoute(page)) return true;
      this.logger.warn(
        `Página de materiais sem rota associada, omitida da listagem. ID=${page.id}`,
      );
      return false;
    });

    if (pages.length === 0) return [];

    const allMedia = await this.mediaItemProcessor.findManyMediaItemsByTargets(
      pages.map((page) => page.id),
      WEEK_MATERIAL_ENTITY_TYPE,
    );

    const mediaByPage = new Map<string, MediaItemEntity[]>();
    for (const item of allMedia) {
      const bucket = mediaByPage.get(item.targetId);
      if (bucket) {
        bucket.push(item);
      } else {
        mediaByPage.set(item.targetId, [item]);
      }
    }

    return pages.map((page) =>
      toWeekMaterialsPageResponse(page, mediaByPage.get(page.id) ?? []),
    );
  }

  /** Returns the page currently published as the week material, if any. */
  async getCurrentWeek(): Promise<WeekMaterialsPageResponseDTO | null> {
    const page = await this.pageRepo.findCurrentWeek();
    if (!page) {
      this.logger.debug('Nenhuma página marcada como material da semana.');
      return null;
    }

    const mediaItems = await this.findMediaOfPage(page.id);
    return toWeekMaterialsPageResponse(page, mediaItems);
  }
}
