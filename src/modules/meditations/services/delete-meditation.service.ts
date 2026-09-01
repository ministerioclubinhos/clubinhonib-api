import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { RouteService } from 'src/modules/routes/route.service';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MeditationRepository } from '../repositories/meditation.repository';
import { GetMeditationService } from './get-meditation.service';
import { MEDITATION_ENTITY_TYPE } from '../constants';

@Injectable()
export class DeleteMeditationService {
  private readonly logger = new Logger(DeleteMeditationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly meditationRepo: MeditationRepository,
    private readonly getService: GetMeditationService,
    private readonly s3Service: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async remove(id: string): Promise<void> {
    const meditation = await this.getService.findEntityOrFail(id);

    try {
      const media = await this.mediaItemProcessor.findMediaItemsByTarget(
        id,
        MEDITATION_ENTITY_TYPE,
      );

      if (media.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(media, (url: string) =>
          this.s3Service.delete(url),
        );
        this.logger.debug(
          `${media.length} mídia(s) removida(s) da meditação ${id}`,
        );
      }

      await this.dataSource.transaction(async (manager: EntityManager) => {
        await this.meditationRepo.removeMeditation(meditation, manager);
      });

      await this.routeService.removeRouteByEntity(MEDITATION_ENTITY_TYPE, id);

      this.logger.log(`Meditação removida. ID=${id}`);
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao remover meditação. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro inesperado ao remover meditação.',
        error as Error,
      );
    }
  }
}
