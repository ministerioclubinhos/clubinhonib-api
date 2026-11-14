import {
  AppNotFoundException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { Injectable, Logger } from '@nestjs/common';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { ImageSectionRepository } from '../repository/image-section.repository';

@Injectable()
export class ImageSectionDeleteService {
  private readonly logger = new Logger(ImageSectionDeleteService.name);

  constructor(
    private readonly sectionRepository: ImageSectionRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly awsS3Service: AwsS3Service,
  ) {}

  async deleteSection(id: string): Promise<void> {
    try {
      this.logger.debug(`🔍 Buscando seção com ID: ${id}`);
      const section = await this.sectionRepository.findById(id);

      if (!section) {
        this.logger.warn(`⚠️ Seção com id=${id} não encontrada`);
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          `Seção com id=${id} não encontrada`,
        );
      }

      this.logger.debug(`🔍 Buscando mídias associadas à seção`);
      const mediaItems: MediaItemEntity[] =
        await this.mediaItemProcessor.findMediaItemsByTarget(
          section.id,
          MediaTargetType.ImagesPage,
        );

      if (mediaItems.length > 0) {
        this.logger.debug(
          `🗑️ Iniciando remoção de ${mediaItems.length} mídias`,
        );
        await this.mediaItemProcessor.deleteMediaItems(
          mediaItems,
          (url: string) => this.awsS3Service.delete(url),
        );
      } else {
        this.logger.debug(`ℹ️ Nenhuma mídia associada à seção encontrada`);
      }

      this.logger.debug(`🗑️ Removendo a seção do banco de dados`);
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      await this.sectionRepository.runInTransaction((manager) =>
        this.sectionRepository.removeInTransaction(manager, section),
      );

      this.logger.debug(`✅ Seção removida com sucesso: ID=${id}`);
    } catch (error: unknown) {
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        'Erro ao remover a seção. Rollback executado.',
        errStack,
      );
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_DELETE_ERROR,
        'Erro ao remover a seção',
        error as Error,
      );
    }
  }
}
