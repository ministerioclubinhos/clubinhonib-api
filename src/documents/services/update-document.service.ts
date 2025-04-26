import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import {
  MediaType,
  UploadType,
} from 'src/share/media/media-item/media-item.entity';
import { UpdateDocumentDto } from '../dto/update-document.dto';
import { DocumentDto } from '../dto/document-response.dto';
import { DocumentRepository } from '../document.repository';

@Injectable()
export class UpdateDocumentService {
  private readonly logger = new Logger(UpdateDocumentService.name);

  constructor(
    @Inject(DocumentRepository)
    private readonly documentRepo: DocumentRepository,
    private readonly s3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(
    id: string,
    dto: UpdateDocumentDto,
    file?: Express.Multer.File,
  ): Promise<DocumentDto> {
    this.logger.log(`🛠️ Atualizando documento ID=${id}`);

    const existingDocument = await this.documentRepo.findOneById(id);
    if (!existingDocument) {
      this.logger.warn(`⚠️ Documento não encontrado: ID=${id}`);
      throw new NotFoundException('Documento não encontrado');
    }

    if (!dto.media) {
      this.logger.error('❌ Dados da mídia são obrigatórios');
      throw new BadRequestException('Dados da mídia são obrigatórios.');
    }

    try {
      const existingMedia = await this.mediaItemProcessor.findMediaItemByTarget(id, 'document');
      if (existingMedia) {
        this.logger.log(`🧹 Removendo mídia antiga: ID=${existingMedia.id}`);
        await this.mediaItemProcessor.removeMediaItem(existingMedia, this.s3Service.delete.bind(this.s3Service));
      }

      const updatedDocument = await this.documentRepo.upsertOne({
        id,
        name: dto.name,
        description: dto.description,
      });
      this.logger.log(`✅ Documento atualizado: ID=${updatedDocument.id}`);

      let mediaUrl = dto.media.url?.trim() || '';
      let originalName = dto.media.originalName;
      let size = dto.media.size;

      const isLocalFile = dto.media.isLocalFile === true;
      const isUpload = dto.media.uploadType === UploadType.UPLOAD;
      const isLink = dto.media.uploadType === UploadType.LINK;

      if (isLocalFile && isUpload) {
        if (!file) {
          this.logger.error('❌ Arquivo de upload não enviado');
          throw new BadRequestException('Arquivo de upload não enviado.');
        }

        this.logger.log(`⬆️ Enviando novo arquivo para S3: ${file.originalname}`);
        mediaUrl = await this.s3Service.upload(file);
        originalName = file.originalname;
        size = file.size;
      }

      const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(
        {
          title: dto.media.title,
          description: dto.media.description,
          mediaType: MediaType.DOCUMENT,
          uploadType: isUpload ? UploadType.UPLOAD : UploadType.LINK,
          platformType: isLink ? dto.media.platformType : null,
          url: mediaUrl,
          originalName,
          size,
          isLocalFile,
          fileField: dto.media.fileField,
        },
        id,
        'document',
      );

      const savedMedia = await this.mediaItemProcessor.upsertMediaItem(undefined, mediaEntity);
      this.logger.log(`🎞️ Nova mídia salva: ID=${savedMedia.id}`);

      return DocumentDto.fromEntity(updatedDocument, savedMedia);
    } catch (error) {
      this.logger.error(`❌ Erro ao atualizar documento ID=${id}`, error.stack);
      throw new InternalServerErrorException('Erro ao atualizar o documento.');
    }
  }
}
