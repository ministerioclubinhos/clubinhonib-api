import { Injectable, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { DeleteRouteService } from 'src/modules/routes/services/delete-route.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { VideosPageRepository } from '../repositories/video-page.repository';
import { GetVideosPageService } from './get-video-page.service';
import { VIDEO_PAGE_ENTITY_TYPE } from '../constants';

@Injectable()
export class DeleteVideosPageService {
  private readonly logger = new Logger(DeleteVideosPageService.name);

  constructor(
    private readonly videosPageRepo: VideosPageRepository,
    private readonly getService: GetVideosPageService,
    private readonly s3: AwsS3Service,
    private readonly deleteRouteService: DeleteRouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(id: string): Promise<void> {
    const page = await this.getService.findEntityOrFail(id);

    try {
      // Vídeos e página saem na mesma transação: se a remoção falhar, nada some
      // pela metade. Os arquivos do S3 só são apagados depois do commit.
      const urls = await this.videosPageRepo.runInTransaction(
        async (manager: EntityManager) => {
          const videos =
            await this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
              manager,
              page.id,
              VIDEO_PAGE_ENTITY_TYPE,
            );
          await this.mediaItemProcessor.deleteMediaItemsByTargetInTransaction(
            manager,
            page.id,
            VIDEO_PAGE_ENTITY_TYPE,
          );
          // A página sai antes da rota: com a página removida, a chave
          // estrangeira deixa de apontar para a rota e a exclusão dela fica livre.
          await this.videosPageRepo.removePage(page, manager);
          return videos.filter((v) => v.isLocalFile).map((v) => v.url);
        },
      );
      await this.mediaItemProcessor.discardUnreferencedUploads(
        urls,
        (url: string) => this.s3.delete(url),
      );
      this.logger.debug(`${urls.length} arquivo(s) da página ${id} apagado(s)`);

      if (page.route?.id) {
        await this.deleteRouteService.removeRoute(page.route.id);
      } else {
        await this.deleteRouteService.removeRouteByEntity(
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
