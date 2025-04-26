import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { VideosPageRepository } from '../video-page.repository';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { VideosPageResponseDto } from '../dto/videos-page-response.dto';

@Injectable()
export class GetVideosPageService {
  private readonly logger = new Logger(GetVideosPageService.name);

  constructor(
    private readonly videosPageRepo: VideosPageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async findAll(): Promise<VideosPageResponseDto[]> {
    this.logger.debug('📡 Listando todas as páginas de vídeos...');
    const pages = await this.videosPageRepo.findAll();
    const pageIds = pages.map((page) => page.id);
    const mediaItems = await this.mediaItemProcessor.findManyMediaItemsByTargets(pageIds, 'VideosPage');

    const mediaMap = new Map<string, typeof mediaItems>();
    for (const item of mediaItems) {
      if (!mediaMap.has(item.targetId)) mediaMap.set(item.targetId, []);
      mediaMap.get(item.targetId)!.push(item);
    }

    return pages.map((page) => VideosPageResponseDto.fromEntity(page, mediaMap.get(page.id) || []));
  }

  async findOne(id: string): Promise<VideosPageResponseDto> {
    this.logger.debug(`📡 Buscando página de vídeos ID=${id}...`);
    const page = await this.videosPageRepo.findById(id);
    if (!page) throw new NotFoundException('Página de vídeos não encontrada.');

    const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(page.id, 'VideosPage');
    return VideosPageResponseDto.fromEntity(page, mediaItems);
  }
}
