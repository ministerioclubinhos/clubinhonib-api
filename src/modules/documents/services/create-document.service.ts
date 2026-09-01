import { Injectable, Logger } from '@nestjs/common';
import {
  AppBusinessException,
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteType } from 'src/modules/routes/route-page.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { DOCUMENT_MEDIA_TARGET_TYPE } from '../constants';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { DocumentDto } from '../dto/document-response.dto';
import { DocumentRepository } from '../document.repository';
import { DocumentEntity } from '../entities/document.entity';

@Injectable()
export class CreateDocumentService {
  private readonly logger = new Logger(CreateDocumentService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly documentRepo: DocumentRepository,
    private readonly s3Service: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaProcessor: MediaItemProcessor,
  ) {}

  async createDocument(
    dto: CreateDocumentDto,
    file?: Express.Multer.File,
  ): Promise<DocumentDto> {
    this.logger.verbose(`→ createDocument | name="${dto.name}"`);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    this.logger.debug('▶️  Transaction started');

    // O arquivo sobe antes do commit e sobrevive ao rollback: o rastreador
    // permite apagá-lo do bucket quando a criação falha.
    const uploads = new S3UploadTracker((uploaded: Express.Multer.File) =>
      this.s3Service.upload(uploaded),
    );

    try {
      const savedDoc = await this.persistDocument(runner, dto);
      await this.attachRoute(runner, savedDoc, dto);
      const media = await this.processMedia(
        runner,
        savedDoc.id,
        dto,
        uploads,
        file,
      );

      await runner.commitTransaction();
      this.logger.debug('✅  Transaction committed');

      return DocumentDto.fromEntity(savedDoc, media);
    } catch (err: unknown) {
      await runner.rollbackTransaction();
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
    } finally {
      await runner.release();
      this.logger.debug('⛔  QueryRunner released');
    }
  }

  private async persistDocument(
    runner: QueryRunner,
    dto: CreateDocumentDto,
  ): Promise<DocumentEntity> {
    this.logger.debug('📝 persistDocument()');

    const docRepo = runner.manager.getRepository(DocumentEntity);

    const doc = docRepo.create({
      name: dto.name,
      description: dto.description,
    });
    const saved = await docRepo.save(doc);
    this.logger.debug(`   ↳ Document saved (ID=${saved.id})`);

    return saved;
  }

  private async attachRoute(
    runner: QueryRunner,
    document: DocumentEntity,
    dto: CreateDocumentDto,
  ): Promise<void> {
    this.logger.debug('🛤️  attachRoute()');

    const path = await this.routeService.generateAvailablePath(
      dto.name,
      'documento_',
    );
    this.logger.debug(`   ↳ availablePath="${path}"`);

    const route = await this.routeService.createRouteWithManager(
      runner.manager,
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
    await runner.manager.save(document);
    this.logger.verbose(`   ↩  attachRoute() OK | routeID=${route.id}`);
  }

  private async processMedia(
    runner: QueryRunner,
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
