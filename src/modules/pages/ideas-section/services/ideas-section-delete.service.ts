import { Injectable, Logger } from '@nestjs/common';
import {
  AppNotFoundException,
  AppBusinessException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DataSource } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IdeasSectionRepository } from '../repository/ideas-section.repository';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';

@Injectable()
export class IdeasSectionDeleteService {
  private readonly logger = new Logger(IdeasSectionDeleteService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
    private readonly ideasSectionRepository: IdeasSectionRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async deleteSection(id: string): Promise<void> {
    this.logger.log(`🚀 Iniciando exclusão de seção de ideias ID=${id}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const existingSection = await queryRunner.manager.findOne(
        IdeasSectionEntity,
        {
          where: { id },
        },
      );

      if (!existingSection) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Seção de ideias com ID=${id} não encontrada`,
        );
      }

      if (existingSection.page) {
        throw new AppBusinessException(
          ErrorCode.SECTION_DELETE_ERROR,
          `Seção de ideias ID=${id} está vinculada à página ID=${existingSection.page.id}. Remova a vinculação primeiro ou delete a página.`,
        );
      }

      const mediaItems = await queryRunner.manager.find(MediaItemEntity, {
        where: {
          targetId: id,
          targetType: MediaTargetType.IdeasSection,
        },
      });

      // Os arquivos só saem depois do commit: apagá-los antes deixaria as
      // mídias apontando para objetos inexistentes se a transação falhasse.
      const filesToDelete = mediaItems
        .filter((media) => media.isLocalFile && media.url)
        .map((media) => media.url);

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

      for (const url of filesToDelete) {
        await this.awsS3Service.delete(url);
      }
      this.logger.log(`✅ Seção de ideias ID=${id} excluída com sucesso`);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Erro ao excluir seção de ideias ID=${id}`, errStack);
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_DELETE_ERROR,
        'Erro ao excluir a seção de ideias',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      await queryRunner.release();
    }
  }
}
