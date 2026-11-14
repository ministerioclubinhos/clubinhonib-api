import { Injectable, Logger } from '@nestjs/common';
import {
  AppNotFoundException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { DocumentsRepository } from '../repositories/documents.repository';
import { DeleteRouteService } from 'src/modules/routes/services/delete-route.service';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { DOCUMENT_MEDIA_TARGET_TYPES } from '../constants';

@Injectable()
export class DeleteDocumentService {
  private readonly logger = new Logger(DeleteDocumentService.name);

  constructor(
    private readonly documentRepo: DocumentsRepository,
    private readonly s3Service: AwsS3Service,
    private readonly deleteRouteService: DeleteRouteService,

    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.log(`🗑️ [DELETE] Iniciando remoção do documento ID=${id}`);

    const document = await this.documentRepo.findById(id);
    if (!document) {
      this.logger.warn(`⚠️ Documento não encontrado: ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.DOCUMENT_NOT_FOUND,
        'Documento não encontrado',
      );
    }

    try {
      const media = await this.mediaItemProcessor.findMediaItemsByTargetAnyType(
        id,
        DOCUMENT_MEDIA_TARGET_TYPES,
      );
      if (media.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(media, (url: string) =>
          this.s3Service.delete(url),
        );
        this.logger.log(`🧹 ${media.length} mídias associadas removidas`);
      }

      await this.documentRepo.remove(document);
      await this.deleteRouteService.removeRouteByEntity(
        MediaTargetType.Document,
        id,
      );
      this.logger.log(`🛤️ Rota removida`);

      this.logger.log(`✅ Documento removido com sucesso: ID=${id}`);
    } catch (error: unknown) {
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`❌ Erro ao remover documento ID=${id}`, errStack);
      throw new AppInternalException(
        ErrorCode.DATABASE_ERROR,
        'Erro ao remover documento.',
      );
    }
  }
}
