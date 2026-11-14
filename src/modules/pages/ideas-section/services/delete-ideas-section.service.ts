import { DeleteIdeaAiAssetsService } from '../../ideas-section-ai/services/delete-idea-ai-assets.service';
import { Injectable, Logger } from '@nestjs/common';
import {
  AppNotFoundException,
  AppBusinessException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';

import { IdeasSectionsRepository } from '../repositories/ideas-sections.repository';

@Injectable()
export class DeleteIdeasSectionService {
  private readonly logger = new Logger(DeleteIdeasSectionService.name);

  constructor(
    private readonly aiAssets: DeleteIdeaAiAssetsService,
    private readonly sectionRepo: IdeasSectionsRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly awsS3Service: AwsS3Service,
  ) {}

  /** Recusa a ideia: sai da fila e os arquivos saem do bucket. */
  async deleteSection(id: string): Promise<void> {
    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      const filesToDelete = await this.sectionRepo.runInTransaction(
        async (manager) => {
          // A página precisa vir junto: sem a relação carregada, a checagem
          // abaixo nunca disparava e uma ideia já publicada podia ser apagada.
          const existingSection = await this.sectionRepo.findByIdInTransaction(
            manager,
            id,
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

          const aiUrls = await this.aiAssets.remove(id, manager);
          const mediaItems =
            await this.mediaItemProcessor.findMediaItemsByTargetInTransaction(
              manager,
              id,
              MediaTargetType.IdeasSection,
            );

          if (mediaItems.length > 0) {
            await this.mediaItemProcessor.deleteMediaItemsByTargetInTransaction(
              manager,
              id,
              MediaTargetType.IdeasSection,
            );
          }

          await this.sectionRepo.deleteByIdInTransaction(manager, id);

          // Os arquivos só saem depois do commit: apagá-los antes deixaria as
          // mídias apontando para objetos inexistentes se a transação falhasse.
          return [
            ...aiUrls,
            ...mediaItems
              .filter((media) => media.isLocalFile && media.url)
              .map((media) => media.url),
          ];
        },
      );

      await this.mediaItemProcessor.discardUnreferencedUploads(
        filesToDelete,
        (url) => this.awsS3Service.delete(url),
      );
      this.logger.log(`Ideia compartilhada removida. ID=${id}`);
    } catch (error: unknown) {
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
    }
  }
}
