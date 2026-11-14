import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { WeekMaterialsPageRepository } from '../repositories/week-material-page.repository';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { WeekMaterialsPageResponseDTO } from '../dto/week-material-response.dto';
import { WeekMaterialSummaryDTO } from '../dto/week-material-summary.dto';
import { QueryWeekMaterialsDto } from '../dto/query-week-materials.dto';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { toWeekMaterialSummary, toWeekMaterialsPageResponse } from '../mappers';
import { WeekMaterialDuplicate, WeekMaterialDuplicateCriteria } from '../types';
import { duplicateSearchFragments, isDuplicateWeekMaterial } from '../utils';
import {
  WEEK_MATERIAL_DUPLICATE_RESULT_LIMIT,
  WEEK_MATERIAL_DUPLICATE_SCAN_LIMIT,
  WEEK_MATERIALS_DEFAULT_LIMIT,
  WEEK_MATERIALS_DEFAULT_PAGE,
  WEEK_MATERIAL_ENTITY_TYPE,
} from '../constants';

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

  async findOneBySourceLessonId(
    sourceLessonId: string,
  ): Promise<WeekMaterialsPageEntity | null> {
    return this.pageRepo.findOneBySourceLessonId(sourceLessonId);
  }

  /**
   * Existing pages that look like the material about to be created: the same
   * week for a weekly material, the same title for a special one. Informative
   * only — two pages for the same week are allowed and get distinct routes.
   */
  async findPossibleDuplicates(
    criteria: WeekMaterialDuplicateCriteria,
  ): Promise<WeekMaterialDuplicate[]> {
    const fragments = duplicateSearchFragments(criteria);
    if (fragments.length === 0) return [];
    const candidates = await this.pageRepo.findByTitleFragments(
      fragments,
      WEEK_MATERIAL_DUPLICATE_SCAN_LIMIT,
    );
    return candidates
      .filter((page) => isDuplicateWeekMaterial(page, criteria))
      .slice(0, WEEK_MATERIAL_DUPLICATE_RESULT_LIMIT)
      .map((page) => ({
        id: page.id,
        title: page.title,
        routePath: page.route?.path ?? null,
      }));
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

  /**
   * Listagem paginada do painel: resumo de cada página, com a contagem de
   * mídias por tipo.
   *
   * Uma página sem rota continua aparecendo, com `routePath` nulo — antes ela
   * era silenciosamente omitida, e o administrador não tinha como descobrir o
   * registro inconsistente para corrigi-lo.
   */
  async findAllPaginated(
    query: QueryWeekMaterialsDto,
  ): Promise<Paginated<WeekMaterialSummaryDTO>> {
    const page = query.page ?? WEEK_MATERIALS_DEFAULT_PAGE;
    const limit = query.limit ?? WEEK_MATERIALS_DEFAULT_LIMIT;

    const { items, total } = await this.pageRepo.findAllPaginated(query);

    return {
      data: await this.summarize(items),
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  /** Resolve as mídias de uma página inteira em uma consulta só. */
  private async summarize(
    pages: WeekMaterialsPageEntity[],
  ): Promise<WeekMaterialSummaryDTO[]> {
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
      toWeekMaterialSummary(page, mediaByPage.get(page.id) ?? []),
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
