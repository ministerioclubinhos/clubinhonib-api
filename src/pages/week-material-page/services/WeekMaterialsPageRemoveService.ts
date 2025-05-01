import {
    Injectable,
    Logger,
    NotFoundException,
    BadRequestException,
  } from '@nestjs/common';
  import { DataSource, QueryRunner } from 'typeorm';
  import { AwsS3Service } from 'src/aws/aws-s3.service';
  import { RouteService } from 'src/route/route.service';
  import { MediaTargetType } from 'src/share/media/media-target-type.enum';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
  import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
  
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
        
        const mediaItems = await this.validateMedia(page.id, queryRunner);
        if (mediaItems.length > 0) {
          await this.mediaItemProcessor.deleteMediaItems(mediaItems, this.awsS3Service.delete.bind(this.awsS3Service));
          this.logger.debug(`🗑️ Removidas ${mediaItems.length} mídias associadas à página ID=${id}`);
        }
  
        if (page.route?.id) {
          const route = await this.routeService.findById(page.route.id);
          if (route) {
            await this.routeService.removeRoute(page.route.id);
            this.logger.debug(`🗑️ Rota ID=${page.route.id} removida`);
          } else {
            this.logger.warn(`⚠️ Rota ID=${page.route.id} não encontrada para remoção`);
          }
        }
  
        await queryRunner.manager.remove(WeekMaterialsPageEntity, page);
        this.logger.debug(`🗑️ Página ID=${id} removida do banco`);
  
        await queryRunner.commitTransaction();
        this.logger.debug(`✅ Página removida com sucesso. ID=${id}`);
      } catch (error) {
        await queryRunner.rollbackTransaction();
        this.logger.error('❌ Erro ao remover página. Rollback executado.', error.stack);
        throw new BadRequestException('Erro ao remover a página de materiais.');
      } finally {
        await queryRunner.release();
      }
    }
  
    private async validatePage(id: string, queryRunner: QueryRunner): Promise<WeekMaterialsPageEntity> {
      const page = await queryRunner.manager.findOne(WeekMaterialsPageEntity, {
        where: { id },
        relations: ['route'],
      });
      if (!page) {
        this.logger.warn(`⚠️ Página ID=${id} não encontrada`);
        throw new NotFoundException('Página não encontrada');
      }
      return page;
    }
  
    private async validateMedia(pageId: string, queryRunner: QueryRunner): Promise<MediaItemEntity[]> {
      const mediaItems = await this.mediaItemProcessor.findMediaItemsByTarget(
        pageId,
        MediaTargetType.WeekMaterialsPage,
      );
      this.logger.debug(`🔍 Encontradas ${mediaItems.length} mídias para página ID=${pageId}`);
      return mediaItems;
    }
  }