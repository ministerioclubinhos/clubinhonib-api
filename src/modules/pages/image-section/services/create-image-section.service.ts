import { Injectable, Logger } from '@nestjs/common';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { ImageSectionRepository } from '../repository/image-section.repository';
import { CreateImageSectionDto } from '../dto/create-image-section.dto';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { ImageSectionResponseDto } from '../dto/image-section-response.dto';
import { toImageSectionResponse } from '../mappers';
import { NotificationService } from 'src/shared/providers/notification/notification.service';
import { UploadedFilesDict } from '../types';
import {
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class ImageSectionCreateService {
  private readonly logger = new Logger(ImageSectionCreateService.name);

  constructor(
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly imageSectionRepository: ImageSectionRepository,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Registra as fotos enviadas por um clubinho.
   *
   * Elas nascem sem página e fora do ar: entram na fila e a administração
   * decide o que vai para o feed. Os administradores são avisados na hora.
   */
  async createSection(
    dto: CreateImageSectionDto,
    filesDict: UploadedFilesDict,
    author?: { email?: string },
  ): Promise<ImageSectionResponseDto> {
    this.logger.log(
      '🚀 Iniciando criação de seção órfã (sem página associada)',
    );

    // Os arquivos sobem antes do commit e sobrevivem ao rollback: o rastreador
    // permite apagá-los do bucket quando a criação falha.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      // A transação é aberta pelo repositório; aqui só se decide o que entra
      // nela. O rollback acontece sozinho quando o bloco lança.
      const { savedSection, mediaItems } =
        await this.imageSectionRepository.runInTransaction(async (manager) => {
          const section = await this.imageSectionRepository.createInTransaction(
            manager,
            {
              caption: dto.caption,
              description: dto.description,
              // Nasce fora do ar; publicar é decisão da administração.
              public: false,
              page: null,
            },
          );

          this.validateFiles(dto, filesDict);

          const preparedMediaItems = dto.mediaItems.map((item) => ({
            ...item,
            fileField: item.fieldKey,
          }));

          const media: MediaItemEntity[] =
            await this.mediaItemProcessor.processMediaItemsPolymorphic(
              preparedMediaItems,
              section.id,
              MediaTargetType.ImagesPage,
              filesDict,
              uploads.upload,
            );

          return { savedSection: section, mediaItems: media };
        });

      this.logger.log(`Publicação de fotos criada. ID=${savedSection.id}`);

      // O aviso nunca derruba o envio: as fotos já estão na fila.
      await this.notificationService.notifyNewImageShared(
        {
          caption: savedSection.caption,
          description: savedSection.description,
          createdAt: savedSection.createdAt,
        },
        author,
      );

      return toImageSectionResponse(savedSection, mediaItems);
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro ao criar seção', errStack);
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_CREATE_ERROR,
        'Erro ao criar a seção',
        error as Error,
      );
    }
  }

  private validateFiles(
    dto: CreateImageSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ) {
    for (const media of dto.mediaItems) {
      if (media.uploadType === UploadType.UPLOAD && media.isLocalFile) {
        if (!media.originalName) {
          throw new AppValidationException(
            ErrorCode.MEDIA_FIELD_MISSING,
            'Campo originalName ausente',
          );
        }
        if (!media.fieldKey || !filesDict[media.fieldKey]) {
          throw new AppValidationException(
            ErrorCode.MEDIA_FILE_NOT_FOUND,
            `Arquivo não encontrado para fieldKey: ${media.fieldKey}`,
          );
        }
      }
    }
  }
}
