import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  AppInternalException,
  AppNotFoundException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DataSource } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType, RouteEntity } from 'src/modules/routes/route-page.entity';
import { DocumentRepository } from '../document.repository';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { DocumentEntity } from '../entities/document.entity';
import {
  DOCUMENT_MEDIA_TARGET_TYPE,
  DOCUMENT_MEDIA_TARGET_TYPES,
} from '../constants';

@Injectable()
export class UpdateDocumentService {
  private readonly logger = new Logger(UpdateDocumentService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly documentRepo: DocumentRepository,
    private readonly s3Service: AwsS3Service,
    private readonly mediaProcessor: MediaItemProcessor,
    private readonly routeService: RouteService,
  ) {}

  async execute(
    id: string,
    dto: UpdateDocumentDto & { isLocalFile?: boolean },
    file?: Express.Multer.File,
  ): Promise<DocumentEntity> {
    this.logger.log(`🛠️ Atualizando documento ID=${id}`);

    const existingDocument = await this.documentRepo.findOneWithRelations(id);
    if (!existingDocument) {
      this.logger.warn(`⚠️ Documento não encontrado: ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.DOCUMENT_NOT_FOUND,
        'Documento não encontrado.',
      );
    }

    if (!dto.media) {
      this.logger.error('❌ Dados da mídia são obrigatórios.');
      throw new AppValidationException(
        ErrorCode.VALIDATION_ERROR,
        'Dados da mídia são obrigatórios.',
      );
    }

    // O arquivo sobe fora da transação: o rastreador permite apagá-lo do
    // bucket quando a atualização falha depois do upload.
    const uploads = new S3UploadTracker((uploaded: Express.Multer.File) =>
      this.s3Service.upload(uploaded),
    );

    try {
      const savedDocument = await this.dataSource.transaction(
        async (manager) => {
          const updatedDocument = manager.merge(
            DocumentEntity,
            existingDocument,
            {
              name: dto.name,
              description: dto.description,
            },
          );
          const saved = await manager.save(DocumentEntity, updatedDocument);
          this.logger.log(`✅ Documento atualizado: ${saved.id}`);

          if (saved.route) {
            saved.route = await this.upsertDocumentRoute(
              saved.route.id,
              {
                name: dto.name,
                subtitle: dto.media?.title,
                description: dto.description,
              },
              saved.id,
            );
          }

          return saved;
        },
      );

      await this.syncMedia(savedDocument, dto, uploads, file);
      this.logger.log('📎 Mídia atualizada com sucesso.');

      return savedDocument;
    } catch (error: unknown) {
      await this.mediaProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3Service.delete(url),
      );

      this.logger.error(
        `Erro ao atualizar documento. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro ao atualizar o documento.',
        error as Error,
      );
    }
  }

  /**
   * Aplica a mídia recebida sobre a atual.
   *
   * Tudo passa por `cleanAndReplaceMediaItems`: ele sobe o arquivo novo antes
   * de apagar o antigo, reaproveita o objeto do S3 quando a edição não troca o
   * arquivo e só apaga o que deixou de ser referenciado. O caminho manual que
   * existia aqui apagava a URL da mídia sempre que o formulário reenviava um
   * upload sem arquivo novo — e o formulário faz isso em toda edição.
   */
  private async syncMedia(
    document: DocumentEntity,
    dto: UpdateDocumentDto & { isLocalFile?: boolean },
    uploads: S3UploadTracker,
    file?: Express.Multer.File,
  ): Promise<void> {
    const media = dto.media;
    if (!media) return;

    const existingMedia =
      await this.mediaProcessor.findMediaItemsByTargetAnyType(
        document.id,
        DOCUMENT_MEDIA_TARGET_TYPES,
      );

    const fieldKey = media.fileField ?? 'file';
    const filesDict = file ? { [fieldKey]: file } : {};

    await this.mediaProcessor.cleanAndReplaceMediaItems(
      [
        {
          id: media.id ?? existingMedia[0]?.id,
          title: media.title ?? document.name,
          description: media.description ?? `Documento: ${document.name}`,
          mediaType: media.mediaType,
          uploadType: media.uploadType,
          platformType: media.isLocalFile ? undefined : media.platformType,
          url: media.url,
          originalName: media.originalName,
          size: media.size,
          isLocalFile: media.isLocalFile,
          fileField: fieldKey,
        },
      ],
      document.id,
      DOCUMENT_MEDIA_TARGET_TYPE,
      filesDict,
      existingMedia,
      (url: string) => this.s3Service.delete(url),
      uploads.upload,
    );
  }

  private async upsertDocumentRoute(
    routeId: string,
    documentData: { name: string; subtitle?: string; description?: string },
    documentId: string,
  ): Promise<RouteEntity> {
    this.logger.debug(
      `🔄 Iniciando upsert da rota do documento ID: ${routeId}`,
    );

    const routeData: Partial<RouteEntity> = {
      title: documentData.name,
      subtitle: documentData.subtitle ?? documentData.name,
      description: documentData.description ?? '',
      idToFetch: documentId,
      entityType: 'Document',
      entityId: documentId,
      public: false,
      type: RouteType.PAGE,
      path: 'documento_',
      image:
        'https://bucket-clubinho-galeria.s3.us-east-2.amazonaws.com/uploads/img_card.jpg',
    };

    const savedRoute = await this.routeService.upsertRoute(routeId, routeData);
    this.logger.debug(
      `✅ Rota do documento upsertada: ${savedRoute.id}, path: ${savedRoute.path}`,
    );
    return savedRoute;
  }
}
