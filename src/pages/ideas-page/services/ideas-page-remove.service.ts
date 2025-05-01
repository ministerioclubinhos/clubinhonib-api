import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource, In, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { IdeasPageRepository } from '../repositories/ideas-page.repository';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { RouteEntity } from 'src/route/route-page.entity';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';

@Injectable()
export class IdeasPageRemoveService {
  private readonly logger = new Logger(IdeasPageRemoveService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly pageRepo: IdeasPageRepository,
    private readonly routeService: RouteService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {
    this.logger.debug('🛠️ IdeasPageRemoveService inicializado');
  }

  async removeIdeasPage(id: string): Promise<void> {
    this.logger.log(`🚀 Iniciando remoção da página de ideias com ID: ${id}`);
    const queryRunner = this.dataSource.createQueryRunner();
    this.logger.debug('🔗 Conectando ao QueryRunner');
    await queryRunner.connect();
    this.logger.debug('✅ QueryRunner conectado');
    this.logger.debug('🔄 Iniciando transação');
    await queryRunner.startTransaction();
    this.logger.debug('✅ Transação iniciada');

    try {
      this.logger.debug(`🔍 Buscando página com ID: ${id}`);
      const page = await this.pageRepo.findOnePageById(id);
      if (!page) {
        this.logger.warn(`⚠️ Página com ID ${id} não encontrada`);
        throw new NotFoundException(`Página de ideias com id ${id} não encontrada`);
      }
      this.logger.debug(`✅ Página encontrada: ID=${page.id}, title="${page.title}"`);

      const sectionIds = page.sections?.map(s => s.id) || [];
      this.logger.debug(`📂 Encontradas ${sectionIds.length} seções`);

      if (sectionIds.length > 0) {
        this.logger.debug(`🔍 Buscando mídias associadas às seções`);
        const mediaItems = await this.validateMedia(sectionIds);

        this.logger.debug(`🗑️ Iniciando exclusão de ${mediaItems.length} mídias`);
        await this.mediaItemProcessor.deleteMediaItems(mediaItems, this.awsS3Service.delete.bind(this.awsS3Service));
        this.logger.debug(`✅ ${mediaItems.length} mídias excluídas`);
      } else {
        this.logger.debug('ℹ️ Nenhuma seção encontrada, pulando exclusão de mídias');
      }

      if (page.route?.id) {
        this.logger.debug(`🔄 Desvinculando rota ID: ${page.route.id}`);
        await queryRunner.manager.save(IdeasPageEntity, { id: page.id, route: null });
        this.logger.debug(`🛑 route_id setado para NULL`);

        this.logger.debug(`🗑️ Removendo rota ID: ${page.route.id}`);
        await queryRunner.manager.delete(RouteEntity, { id: page.route.id });
        this.logger.debug(`✅ Rota removida diretamente com queryRunner`);

        this.logger.debug(`✅ Rota removida`);
      } else {
        this.logger.debug('ℹ️ Nenhuma rota associada encontrada');
      }

      this.logger.debug(`🗑️ Removendo página ID: ${page.id}`);
      await queryRunner.manager.remove(page);
      this.logger.debug(`✅ Página removida`);

      const remainingSections = await queryRunner.manager.find(IdeasSectionEntity, {
        where: sectionIds.length ? { id: In(sectionIds) } : undefined,
      });

      if (remainingSections.length > 0) {
        this.logger.warn(`⚠️ Seções ainda presentes após exclusão`);
        throw new BadRequestException('Falha ao remover todas as seções associadas');
      }

      this.logger.debug('✅ Iniciando commit da transação');
      await queryRunner.commitTransaction();
      this.logger.log(`✅ Página de ideias removida com sucesso: ID=${id}`);
    } catch (error) {
      this.logger.error('❌ Erro ao remover página de ideias. Iniciando rollback.', error);
      await queryRunner.rollbackTransaction();
      this.logger.debug('✅ Rollback concluído');
      throw new BadRequestException('Erro ao remover a página de ideias.');
    } finally {
      this.logger.debug('🔚 Liberando QueryRunner');
      await queryRunner.release();
      this.logger.debug('✅ QueryRunner liberado');
    }
  }

  private async validateMedia(sectionIds: string[]): Promise<MediaItemEntity[]> {
    const mediaItems = await this.mediaItemProcessor.findManyMediaItemsByTargets(sectionIds, 'IdeasSection');

    return mediaItems;
  }
}
