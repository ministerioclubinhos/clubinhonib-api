import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { RouteType } from 'src/route/route-page.entity';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaType } from 'src/share/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';
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
  ) { }

  async createDocument(
    dto: CreateDocumentDto,
    file?: Express.Multer.File,
  ): Promise<DocumentDto> {
    this.logger.verbose(`→ createDocument | name="${dto.name}"`);

    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    this.logger.debug('▶️  Transaction started');

    try {
      const savedDoc = await this.persistDocument(runner, dto);
      const route = await this.attachRoute(runner, savedDoc, dto);
      const media = await this.processMedia(runner, savedDoc.id, dto, file);

      await runner.commitTransaction();
      this.logger.debug('✅  Transaction committed');

      return DocumentDto.fromEntity(savedDoc, media);
    } catch (err) {
      await runner.rollbackTransaction();
      this.logger.error('💥  Transaction rolled‑back', err.stack);
      throw new BadRequestException(
        `Erro ao criar o documento: ${err.message}`,
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
    file?: Express.Multer.File,
  ) {
    this.logger.debug('🎞️  processMedia()');

    let mediaUrl = dto.media.url?.trim() || '';
    let originalName = dto.media.originalName;
    let size = dto.media.size;

    if (dto.media.isLocalFile) {
      if (!file) {
        this.logger.error('🚫 Arquivo obrigatório não enviado.');
        throw new BadRequestException('Arquivo obrigatório não enviado.');
      }

      this.logger.log(`⬆️ Upload para S3: ${file.originalname}`);
      try {
        mediaUrl = await this.s3Service.upload(file);
        originalName = file.originalname;
        size = file.size;
      } catch (error) {
        this.logger.error(
          `❌ Erro no upload do arquivo: ${file.originalname}`,
          error.stack,
        );
        throw new InternalServerErrorException('Falha no upload do arquivo.');
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
      MediaTargetType.Document,
    );

    const savedMedia = await this.mediaProcessor.saveMediaItem(mediaEntity);

    this.logger.verbose(`✅ Mídia associada criada | mediaID=${savedMedia.id}`);
    return savedMedia;
  }
}
