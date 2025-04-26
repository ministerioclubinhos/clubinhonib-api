import {
  Injectable,
  Logger,
  BadRequestException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaType } from 'src/share/media/media-item/media-item.entity';
import { CreateDocumentDto } from '../dto/create-document.dto';
import { DocumentDto } from '../dto/document-response.dto';
import { DocumentRepository } from '../document.repository';

@Injectable()
export class CreateDocumentService {
  private readonly logger = new Logger(CreateDocumentService.name);

  constructor(
    @Inject(DocumentRepository)
    private readonly documentRepo: DocumentRepository,
    private readonly s3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async execute(
    dto: CreateDocumentDto,
    file?: Express.Multer.File,
  ): Promise<DocumentDto> {
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
      } catch (error) {
        this.logger.error(`❌ Erro no upload do arquivo: ${file.originalname}`, error.stack);
        throw new InternalServerErrorException('Falha ao fazer upload do arquivo.');
      }

      originalName = file.originalname;
      size = file.size;
    }

    try {
      const document = this.documentRepo.create({
        name: dto.name,
        description: dto.description,
      });

      const savedDocument = await this.documentRepo.save(document);
      this.logger.log(`✅ Documento salvo: ID=${savedDocument.id}`);

      const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(
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
        savedDocument.id,
        'document',
      );

      const savedMedia = await this.mediaItemProcessor.saveMediaItem(mediaEntity);
      this.logger.log(`✅ Mídia associada salva: ID=${savedMedia.id}`);

      return DocumentDto.fromEntity(savedDocument, savedMedia);
    } catch (error) {
      this.logger.error('❌ Erro ao criar documento ou mídia.', error.stack);
      throw new InternalServerErrorException('Erro ao criar documento.');
    }
  }
}
