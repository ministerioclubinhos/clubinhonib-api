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
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasPageGetService } from './get-ideas-page.service';
import { collectSectionIds } from '../utils';
import {
  IDEAS_PAGE_ENTITY_TYPE,
  IDEAS_SECTION_MEDIA_TARGET_TYPE,
} from '../constants';

@Injectable()
export class IdeasPageDeleteService {
  private readonly logger = new Logger(IdeasPageDeleteService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly ideasPageRepository: IdeasPageRepository,
    private readonly getService: IdeasPageGetService,
    private readonly routeService: RouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async removePage(id: string): Promise<void> {
    const page = await this.getService.findEntityOrFail(id);

    try {
      const sectionIds = collectSectionIds([page]);

      // As mídias pertencem às seções e não saem por cascata: os registros e os
      // arquivos no S3 precisam ser removidos antes da página.
      if (sectionIds.length > 0) {
        const media = await this.mediaItemProcessor.findManyMediaItemsByTargets(
          sectionIds,
          IDEAS_SECTION_MEDIA_TARGET_TYPE,
        );

        if (media.length > 0) {
          await this.mediaItemProcessor.deleteMediaItems(media, (url: string) =>
            this.awsS3Service.delete(url),
          );
          this.logger.debug(
            `${media.length} mídia(s) removida(s) da página de ideias ${id}`,
          );
        }
      }

      // A página sai antes da rota: com a página removida, a chave estrangeira
      // deixa de apontar para a rota e a exclusão dela fica livre.
      await this.dataSource.transaction(async (manager: EntityManager) => {
        await this.ideasPageRepository.removePage(page, manager);
      });

      if (page.route?.id) {
        await this.routeService.removeRoute(page.route.id);
      } else {
        await this.routeService.removeRouteByEntity(
          IDEAS_PAGE_ENTITY_TYPE,
          page.id,
        );
      }

      this.logger.log(`Página de ideias removida. ID=${id}`);
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao remover página de ideias. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_DELETE_ERROR,
        'Erro ao remover a página de ideias',
        error as Error,
      );
    }
  }
}
