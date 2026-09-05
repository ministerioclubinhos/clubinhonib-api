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
import { ImagePageRepository } from '../repositories/image-page.repository';
import { ImagePageGetService } from './get-image-page.service';
import { collectSectionIds } from '../utils';
import { IMAGE_PAGE_ENTITY_TYPE } from '../constants';

@Injectable()
export class ImagePageDeleteService {
  private readonly logger = new Logger(ImagePageDeleteService.name);

  constructor(
    private readonly imagePageRepository: ImagePageRepository,
    private readonly getService: ImagePageGetService,
    private readonly deleteRouteService: DeleteRouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async removePage(id: string): Promise<void> {
    const page = await this.getService.findEntityOrFail(id);

    try {
      const sectionIds = collectSectionIds([page]);

      if (sectionIds.length > 0) {
        const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(
          sectionIds,
          IMAGE_PAGE_ENTITY_TYPE,
        );

        if (media.length > 0) {
          await this.mediaItemProcessor.deleteMediaItems(media, (url: string) =>
            this.awsS3Service.delete(url),
          );
          this.logger.debug(
            `${media.length} mídia(s) removida(s) da galeria ${id}`,
          );
        }
      }

      // A página sai antes da rota: com a página removida, a chave estrangeira
      // deixa de apontar para a rota e a exclusão dela fica livre.
      await this.imagePageRepository.runInTransaction(
        async (manager: EntityManager) => {
          await this.imagePageRepository.removePage(page, manager);
        },
      );

      if (page.route?.id) {
        await this.deleteRouteService.removeRoute(page.route.id);
      } else {
        await this.deleteRouteService.removeRouteByEntity(
          IMAGE_PAGE_ENTITY_TYPE,
          page.id,
        );
      }

      this.logger.log(`Galeria removida. ID=${id}`);
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao remover galeria. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_DELETE_ERROR,
        'Erro ao remover a galeria',
        error as Error,
      );
    }
  }
}
