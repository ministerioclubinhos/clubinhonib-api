import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { IdeasSectionRepository } from '../repository/ideas-section.repository';
import { IdeasSectionEntity } from 'src/pages/ideas-page/entities/ideas-section.entity';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';

@Injectable()
export class IdeasSectionDeleteService {
  private readonly logger = new Logger(IdeasSectionDeleteService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly ideasSectionRepository: IdeasSectionRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  async deleteSection(id: string): Promise<void> {
    this.logger.log(`🚀 Iniciando exclusão de seção de ideias ID=${id}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingSection = await queryRunner.manager.findOne(IdeasSectionEntity, {
        where: { id },
      });

      if (!existingSection) {
        throw new NotFoundException(`Seção de ideias com ID=${id} não encontrada`);
      }

      if (existingSection.page) {
        throw new BadRequestException(
          `Seção de ideias ID=${id} está vinculada à página ID=${existingSection.page.id}. ` +
          `Remova a vinculação primeiro ou delete a página.`
        );
      }

      const mediaItems = await queryRunner.manager.find(MediaItemEntity, {
        where: {
          targetId: id,
          targetType: MediaTargetType.IdeasSection,
        },
      });

      for (const media of mediaItems) {
        if (media.isLocalFile && media.url) {
          this.logger.debug(`🗑️ Removendo arquivo do S3: ${media.url}`);
          try {
            await this.awsS3Service.delete(media.url);
            this.logger.debug(`✅ Arquivo removido do S3: ${media.url}`);
          } catch (error) {
            this.logger.warn(`⚠️ Erro ao remover arquivo do S3: ${media.url}`, error);
          }
        }
      }

      if (mediaItems.length > 0) {
        await queryRunner.manager.delete(MediaItemEntity, {
          targetId: id,
          targetType: MediaTargetType.IdeasSection,
        });
        this.logger.debug(`✅ ${mediaItems.length} mídias removidas do banco`);
      }

      await queryRunner.manager.delete(IdeasSectionEntity, { id });
      this.logger.debug(`✅ Seção de ideias ID=${id} removida do banco`);

      await queryRunner.commitTransaction();
      this.logger.log(`✅ Seção de ideias ID=${id} excluída com sucesso`);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`❌ Erro ao excluir seção de ideias ID=${id}`, error);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Erro ao excluir a seção de ideias');
    } finally {
      await queryRunner.release();
    }
  }
}
