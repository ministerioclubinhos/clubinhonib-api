import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { VideosPage } from '../entities/video-page.entity';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { VideosPageResponseDto } from '../dto/videos-page-response.dto';
import { VideoPageSummaryDto } from '../dto/video-page-summary.dto';
import { QueryVideoPagesDto } from '../dto/query-video-pages.dto';
import { toVideoPageSummary, toVideosPageResponse } from '../mappers';
import {
  VIDEO_PAGES_DEFAULT_LIMIT,
  VIDEO_PAGES_DEFAULT_PAGE,
  VIDEO_PAGE_ENTITY_TYPE,
} from '../constants';

@Injectable()
export class GetVideosPageService {
  private readonly logger = new Logger(GetVideosPageService.name);

  constructor(
    private readonly videosPageRepo: VideosPageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  /** Carrega a página ou falha com o erro documentado. */
  async findEntityOrFail(id: string): Promise<VideosPage> {
    const page = await this.videosPageRepo.findById(id);
    if (!page) {
      this.logger.warn(`Página de vídeos não encontrada. ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.VIDEO_NOT_FOUND,
        'Página de vídeos não encontrada.',
      );
    }
    return page;
  }

  /** Vídeos associados à página. */
  async findVideosOf(pageId: string): Promise<MediaItemEntity[]> {
    return this.mediaItemProcessor.findMediaItemsByTarget(
      pageId,
      VIDEO_PAGE_ENTITY_TYPE,
    );
  }

  /**
   * Listagem paginada do painel: resumo de cada página, com a contagem de
   * vídeos.
   *
   * Uma página sem rota continua aparecendo, com `routePath` nulo — antes ela
   * era silenciosamente omitida, e o administrador não tinha como descobrir o
   * registro inconsistente para corrigi-lo.
   */
  async findAllPaginated(
    query: QueryVideoPagesDto,
  ): Promise<Paginated<VideoPageSummaryDto>> {
    const page = query.page ?? VIDEO_PAGES_DEFAULT_PAGE;
    const limit = query.limit ?? VIDEO_PAGES_DEFAULT_LIMIT;

    const { items, total } = await this.videosPageRepo.findAllPaginated(query);

    return {
      data: await this.summarize(items),
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit),
    };
  }

  /** Conta os vídeos da página inteira em uma consulta só. */
  private async summarize(pages: VideosPage[]): Promise<VideoPageSummaryDto[]> {
    if (pages.length === 0) return [];

    const mediaItems =
      await this.mediaItemProcessor.findManyMediaItemsByTargets(
        pages.map((page) => page.id),
        VIDEO_PAGE_ENTITY_TYPE,
      );

    const countByPage = new Map<string, number>();
    for (const item of mediaItems) {
      countByPage.set(item.targetId, (countByPage.get(item.targetId) ?? 0) + 1);
    }

    return pages.map((page) =>
      toVideoPageSummary(page, countByPage.get(page.id) ?? 0),
    );
  }

  async findOne(id: string): Promise<VideosPageResponseDto> {
    const page = await this.findEntityOrFail(id);
    const videos = await this.findVideosOf(page.id);
    return toVideosPageResponse(page, videos);
  }
}
