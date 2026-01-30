import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import {
  AppNotFoundException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { RouteService } from 'src/modules/routes/route.service';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

@Injectable()
export class WeekMaterialsPageRemoveService {
  private readonly logger = new Logger(WeekMaterialsPageRemoveService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async removeWeekMaterial(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const page = await this.validatePage(id, queryRunner);

      const mediaItems = await this.validateMedia(page.id);
      if (mediaItems.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(
          mediaItems,
          (url: string) => this.awsS3Service.delete(url),
        );
        this.logger.debug(
          `🗑️ Removidas ${mediaItems.length} mídias associadas à página ID=${id}`,
        );
      }

      if (page.route?.id) {
        const route = await this.routeService.findById(page.route.id);
        if (route) {
          await this.routeService.removeRoute(page.route.id);
          this.logger.debug(`🗑️ Rota ID=${page.route.id} removida`);
        } else {
          this.logger.warn(
            `⚠️ Rota ID=${page.route.id} não encontrada para remoção`,
          );
        }
      }

      await queryRunner.manager.remove(WeekMaterialsPageEntity, page);
      this.logger.debug(`🗑️ Página ID=${id} removida do banco`);

      await queryRunner.commitTransaction();
      this.logger.debug(`✅ Página removida com sucesso. ID=${id}`);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        '❌ Erro ao remover página. Rollback executado.',
        errStack,
      );
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro ao remover a página de materiais.',
      );
    } finally {
      await queryRunner.release();
    }
  }

  private async validatePage(
    id: string,
    queryRunner: QueryRunner,
  ): Promise<WeekMaterialsPageEntity> {
    const page = await queryRunner.manager.findOne(WeekMaterialsPageEntity, {
      where: { id },
      relations: ['route'],
    });
    if (!page) {
      this.logger.warn(`⚠️ Página ID=${id} não encontrada`);
      throw new AppNotFoundException(
        ErrorCode.WEEK_MATERIAL_NOT_FOUND,
        'Página não encontrada',
      );
    }
    return page;
  }

  private async validateMedia(
    pageId: string,
    // _queryRunner: QueryRunner,
  ): Promise<MediaItemEntity[]> {
    const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(
      pageId,
      MediaTargetType.WeekMaterialsPage,
    );
    this.logger.debug(
      `🔍 Encontradas ${mediaItems.length} mídias para página ID=${pageId}`,
    );
    return mediaItems;
  }
}
