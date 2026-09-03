import { Injectable, Logger } from '@nestjs/common';
import {
  AppNotFoundException,
  AppBusinessException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DataSource } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

@Injectable()
export class DeleteIdeasSectionService {
  private readonly logger = new Logger(DeleteIdeasSectionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly awsS3Service: AwsS3Service,
  ) {}

  /** Recusa a ideia: sai da fila e os arquivos saem do bucket. */
  async deleteSection(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // A página precisa vir junto: sem a relação carregada, a checagem
      // abaixo nunca disparava e uma ideia já publicada podia ser apagada.
      const existingSection = await queryRunner.manager.findOne(
        IdeasSectionEntity,
        {
          where: { id },
          relations: { page: true },
        },
      );

      if (!existingSection) {
        throw new AppNotFoundException(
          ErrorCode.IDEA_NOT_FOUND,
          'Ideia compartilhada não encontrada',
        );
      }

      if (existingSection.page) {
        throw new AppBusinessException(
          ErrorCode.SECTION_DELETE_ERROR,
          'Esta ideia já foi publicada em uma página. Remova-a da página antes de excluí-la.',
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
      }

      await queryRunner.manager.delete(IdeasSectionEntity, { id });

      await queryRunner.commitTransaction();

      for (const url of filesToDelete) {
        await this.awsS3Service.delete(url);
      }
      this.logger.log(`Ideia compartilhada removida. ID=${id}`);
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction();
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Erro ao excluir ideia compartilhada. ID=${id}`,
        errStack,
      );
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_DELETE_ERROR,
        'Erro ao excluir a ideia compartilhada',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      await queryRunner.release();
    }
  }
}
