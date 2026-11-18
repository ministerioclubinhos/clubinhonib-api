import { Injectable, Logger } from '@nestjs/common';
import {
  AppBusinessException,
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { EntityManager } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { CreateRouteService } from 'src/modules/routes/services/create-route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import {
  DOCUMENT_MEDIA_TARGET_TYPE,
  DOCUMENT_ROUTE_PREFIX,
} from '../constants';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { DocumentResponseDto } from '../dto/document-response.dto';
import { toDocumentResponse } from '../mappers';
import { DocumentsRepository } from '../repositories/documents.repository';

import { DocumentEntity } from '../entities/document.entity';
import { AnnounceDocumentService } from './announce-document.service';

@Injectable()
export class CreateDocumentService {
  private readonly logger = new Logger(CreateDocumentService.name);

  constructor(
    private readonly documentRepo: DocumentsRepository,
    private readonly s3Service: AwsS3Service,
    private readonly createRouteService: CreateRouteService,
    private readonly mediaProcessor: MediaItemProcessor,
    private readonly announceService: AnnounceDocumentService,
  ) {}

  async createDocument(
    dto: CreateDocumentDto,
    file?: Express.Multer.File,
  ): Promise<DocumentResponseDto> {
    this.logger.verbose(`→ createDocument | name="${dto.name}"`);

    // O arquivo sobe antes do commit e sobrevive ao rollback: o rastreador
    // permite apagá-lo do bucket quando a criação falha.
    const uploads = new S3UploadTracker((uploaded: Express.Multer.File) =>
      this.s3Service.upload(uploaded),
    );

    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      const { savedDoc, media } = await this.documentRepo.runInTransaction(
        async (manager) => {
          const document = await this.persistDocument(manager, dto);
          await this.attachRoute(manager, document, dto);
          const savedMedia = await this.processMedia(
            document.id,
            dto,
            uploads,
            file,
          );

          return { savedDoc: document, media: savedMedia };
        },
      );

      this.logger.debug('✅  Transaction committed');

      // Depois do commit e fora da requisição, como no material da semana.
      this.announceService.announceInBackground(savedDoc);

      return toDocumentResponse(savedDoc, media);
    } catch (err: unknown) {
      await this.mediaProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3Service.delete(url),
      );

      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error('💥  Transaction rolled‑back', error.stack);
      throw new AppBusinessException(
        ErrorCode.VALIDATION_ERROR,
        `Erro ao criar o documento: ${error.message}`,
      );
    }
  }

  private async persistDocument(
    manager: EntityManager,
    dto: CreateDocumentDto,
  ): Promise<DocumentEntity> {
    this.logger.debug('📝 persistDocument()');

    const saved = await this.documentRepo.createInTransaction(manager, {
      name: dto.name,
      description: dto.description,
    });
    this.logger.debug(`   ↳ Document saved (ID=${saved.id})`);

    return saved;
  }

  private async attachRoute(
    manager: EntityManager,
    document: DocumentEntity,
    dto: CreateDocumentDto,
  ): Promise<void> {
    this.logger.debug('🛤️  attachRoute()');

    const path = await this.createRouteService.generateAvailablePath(
      dto.name,
      DOCUMENT_ROUTE_PREFIX,
    );
    this.logger.debug(`   ↳ availablePath="${path}"`);

    const route = await this.createRouteService.createRouteWithManager(
      manager,
      {
        title: dto.name,
        subtitle: dto.media.title || '',
        description: dto.description || '',
        path,
        type: RouteType.DOC,
        entityId: document.id,
        idToFetch: document.id,
        entityType: 'Document',
        image:
          'https://bucket-clubinho-galeria.s3.us-east-2.amazonaws.com/uploads/img_card.jpg',
        public: false,
      },
    );

    document.route = route;
    await this.documentRepo.saveInTransaction(manager, document);
    this.logger.verbose(`   ↩  attachRoute() OK | routeID=${route.id}`);
  }

  private async processMedia(
    documentId: string,
    dto: CreateDocumentDto,
    uploads: S3UploadTracker,
    file?: Express.Multer.File,
  ) {
    this.logger.debug('🎞️  processMedia()');

    let mediaUrl = dto.media.url?.trim() || '';
    let originalName = dto.media.originalName;
    let size = dto.media.size;

    if (dto.media.isLocalFile) {
      if (!file) {
        this.logger.error('🚫 Arquivo obrigatório não enviado.');
        throw new AppValidationException(
          ErrorCode.FILE_REQUIRED,
          'Arquivo obrigatório não enviado.',
        );
      }

      this.logger.log(`⬆️ Upload para S3: ${file.originalname}`);
      try {
        mediaUrl = await uploads.upload(file);
        originalName = file.originalname;
        size = file.size;
      } catch (error: unknown) {
        const errStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(
          `❌ Erro no upload do arquivo: ${file.originalname}`,
          errStack,
        );
        throw new AppInternalException(
          ErrorCode.FILE_UPLOAD_ERROR,
          'Falha no upload do arquivo.',
        );
      }
    }

    const mediaEntity = this.mediaProcessor.buildBaseMediaItem(
      {
        title: dto.media.title,
        description: dto.media.description,
        mediaType: MediaType.DOCUMENT,
        uploadType: dto.media.uploadType,
        platformType: dto.media.platformType,
        fileField: dto.media.fileField ?? 'file',
        isLocalFile: dto.media.isLocalFile,
        url: mediaUrl,
        originalName,
        size,
      },
      documentId,
      DOCUMENT_MEDIA_TARGET_TYPE,
    );

    const savedMedia = await this.mediaProcessor.saveMediaItem(mediaEntity);

    this.logger.verbose(`✅ Mídia associada criada | mediaID=${savedMedia.id}`);
    return savedMedia;
  }
}
