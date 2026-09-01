import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { RouteService } from 'src/modules/routes/route.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { GetVideosPageService } from './get-video-page.service';
import { VIDEO_PAGE_ENTITY_TYPE } from '../constants';

@Injectable()
export class DeleteVideosPageService {
  private readonly logger = new Logger(DeleteVideosPageService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly videosPageRepo: VideosPageRepository,
    private readonly getService: GetVideosPageService,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(id: string): Promise<void> {
    const page = await this.getService.findEntityOrFail(id);

    try {
      const videos = await this.getService.findVideosOf(page.id);

      if (videos.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(videos, (url: string) =>
          this.s3.delete(url),
        );
        this.logger.debug(
          `${videos.length} vídeo(s) removido(s) da página ${id}`,
        );
      }

      // A página sai antes da rota: com a página removida, a chave estrangeira
      // deixa de apontar para a rota e a exclusão dela fica livre.
      await this.dataSource.transaction(async (manager: EntityManager) => {
        await this.videosPageRepo.removePage(page, manager);
      });

      if (page.route?.id) {
        await this.routeService.removeRoute(page.route.id);
      } else {
        await this.routeService.removeRouteByEntity(
          VIDEO_PAGE_ENTITY_TYPE,
          page.id,
        );
      }

      this.logger.log(`Página de vídeos removida. ID=${id}`);
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao remover página de vídeos. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_DELETE_ERROR,
        'Erro ao remover a página de vídeos.',
        error as Error,
      );
    }
  }
}
