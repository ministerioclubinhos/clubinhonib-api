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
import { WeekMaterialsPageRepository } from '../repositories/week-material-page.repository';
import { WeekMaterialsPageGetService } from './get-week-material.service';
import { WEEK_MATERIAL_ENTITY_TYPE } from '../constants';

@Injectable()
export class WeekMaterialsPageRemoveService {
  private readonly logger = new Logger(WeekMaterialsPageRemoveService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly pageRepo: WeekMaterialsPageRepository,
    private readonly getService: WeekMaterialsPageGetService,
    private readonly s3: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async removeWeekMaterial(id: string): Promise<void> {
    const page = await this.getService.findOnePage(id);
    const mediaItems = await this.getService.findMediaOfPage(page.id);

    try {
      if (mediaItems.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(
          mediaItems,
          (url: string) => this.s3.delete(url),
        );
        this.logger.debug(
          `${mediaItems.length} mídia(s) removida(s) da página ${page.id}`,
        );
      }

      await this.dataSource.transaction(async (manager: EntityManager) => {
        await this.pageRepo.removePage(page, manager);
      });

      if (page.route?.id) {
        await this.routeService.removeRoute(page.route.id);
      } else {
        await this.routeService.removeRouteByEntity(
          WEEK_MATERIAL_ENTITY_TYPE,
          page.id,
        );
      }

      this.logger.log(`Página de materiais removida. ID=${id}`);
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao remover página de materiais. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_DELETE_ERROR,
        'Erro ao remover a página de materiais.',
        error as Error,
      );
    }
  }
}
