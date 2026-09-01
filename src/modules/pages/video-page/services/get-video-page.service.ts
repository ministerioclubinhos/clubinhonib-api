import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { VideosPage } from '../entities/video-page.entity';
import { VideosPageResponseDto } from '../dto/videos-page-response.dto';
import { hasRoute, toVideosPageResponse } from '../mappers';
import { VIDEO_PAGE_ENTITY_TYPE } from '../constants';

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

  async findAll(): Promise<VideosPageResponseDto[]> {
    const allPages = await this.videosPageRepo.findAll();

    // Uma página sem rota não pode ser representada no contrato. É omitida da
    // listagem, com registro, para que um dado inconsistente não derrube a
    // lista inteira do administrador.
    const pages = allPages.filter((page) => {
      if (hasRoute(page)) return true;
      this.logger.warn(
        `Página de vídeos sem rota associada, omitida da listagem. ID=${page.id}`,
      );
      return false;
    });

    if (pages.length === 0) return [];

    const mediaItems =
      await this.mediaItemProcessor.findManyMediaItemsByTargets(
        pages.map((page) => page.id),
        VIDEO_PAGE_ENTITY_TYPE,
      );

    const videosByPage = new Map<string, MediaItemEntity[]>();
    for (const item of mediaItems) {
      const bucket = videosByPage.get(item.targetId);
      if (bucket) {
        bucket.push(item);
      } else {
        videosByPage.set(item.targetId, [item]);
      }
    }

    return pages.map((page) =>
      toVideosPageResponse(page, videosByPage.get(page.id) ?? []),
    );
  }

  async findOne(id: string): Promise<VideosPageResponseDto> {
    const page = await this.findEntityOrFail(id);
    const videos = await this.findVideosOf(page.id);
    return toVideosPageResponse(page, videos);
  }
}
