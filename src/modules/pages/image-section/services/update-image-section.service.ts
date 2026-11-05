import { validateClubinhoMedia } from '../media-validation';
import {
  AppNotFoundException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import {
  UploadType,
  MediaItemEntity,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { ImageSectionRepository } from '../repository/image-section.repository';
import { ImagePageGetService } from 'src/modules/pages/image-page/services/get-image-page.service';
import { UpdateImageSectionDto } from '../dto/update-image-section.dto';
import { ImageSectionResponseDto } from '../dto/image-section-response.dto';
import { toImageSectionResponse } from '../mappers';

@Injectable()
export class ImageSectionUpdateService {
  private readonly logger = new Logger(ImageSectionUpdateService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly awsS3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly sectionRepo: ImageSectionRepository,
    private readonly imagePageGetService: ImagePageGetService,
  ) {}

  async updateSection(
    id: string,
    dto: UpdateImageSectionDto,
    filesDict: Record<string, Express.Multer.File>,
  ): Promise<ImageSectionResponseDto> {
    this.logger.log(`🚀 Iniciando atualização da seção com ID: ${id}`);
    // Os arquivos sobem fora da transação: o rastreador permite apagá-los do
    // bucket quando a atualização falha depois do upload.
    const uploads = new S3UploadTracker((file: Express.Multer.File) =>
      this.awsS3Service.upload(file),
    );

    try {
      const section = await this.sectionRepo.findById(id);
      if (!section) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Seção não encontrada',
        );
      }

      const pageIdFromEnv = this.configService.get<string>(
        'FEED_CLUBINHO_PAGE_ID',
      );
      if (!pageIdFromEnv) {
        // Sem a variável, a consulta ia com `undefined` e falhava de forma
        // obscura mais adiante.
        throw new AppInternalException(
          ErrorCode.INTERNAL_ERROR,
          'FEED_CLUBINHO_PAGE_ID não está configurado.',
        );
      }

      const page = await this.imagePageGetService.findEntity(pageIdFromEnv);
      if (!page) {
        throw new AppNotFoundException(
          ErrorCode.RESOURCE_NOT_FOUND,
          'Página padrão não encontrada',
        );
      }

      const existingMedia =
        await this.mediaItemProcessor.findManyMediaItemsByTargets(
          [section.id],
          MediaTargetType.ImagesPage,
        );

      validateClubinhoMedia(dto.mediaItems, filesDict, existingMedia);
      const preparedMedia: MediaItemEntity[] = [];
      for (const input of dto.mediaItems) {
        const stored = existingMedia.find((media) => media.id === input.id);
        const prepared = this.mediaItemProcessor.buildBaseMediaItem(
          input,
          section.id,
          MediaTargetType.ImagesPage,
        );
        if (stored) prepared.id = stored.id;
        const file = input.fieldKey ? filesDict[input.fieldKey] : undefined;
        if (file) {
          prepared.url = await uploads.upload(file);
          prepared.isLocalFile = true;
          prepared.originalName = file.originalname;
          prepared.size = file.size;
        } else if (input.uploadType === UploadType.UPLOAD && stored) {
          prepared.url = stored.url;
          prepared.isLocalFile = stored.isLocalFile;
          prepared.originalName = stored.originalName;
          prepared.size = stored.size;
        }
        preparedMedia.push(prepared);
      }
      const removed = existingMedia.filter(
        (media) => !dto.mediaItems.some((input) => input.id === media.id),
      );
      section.caption = dto.caption;
      section.description = dto.description;
      section.public = dto.public || false;
      section.page = dto.public ? page : null;
      const { savedSection, processedMedia } =
        await this.sectionRepo.runInTransaction(async (manager) => {
          const processedMedia: MediaItemEntity[] = [];
          for (const media of preparedMedia) {
            processedMedia.push(
              await this.mediaItemProcessor.saveMediaItemInTransaction(
                manager,
                media,
              ),
            );
          }
          for (const media of removed)
            await this.mediaItemProcessor.deleteMediaItemByIdInTransaction(
              manager,
              media.id,
            );
          const savedSection = await this.sectionRepo.saveInTransaction(
            manager,
            section,
          );
          return { savedSection, processedMedia };
        });
      // Delete replaced objects only after all rows have committed.
      await this.mediaItemProcessor.discardUnreferencedUploads(
        existingMedia
          .filter(
            (media) =>
              media.isLocalFile &&
              !processedMedia.some((saved) => saved.url === media.url),
          )
          .map((media) => media.url),
        (url: string) => this.awsS3Service.delete(url),
      );

      return toImageSectionResponse(savedSection, processedMedia);
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.awsS3Service.delete(url),
      );

      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error('Erro ao atualizar a seção', errStack);
      const hasCode = error && typeof error === 'object' && 'code' in error;
      if (hasCode) throw error as unknown as Error;
      throw new AppInternalException(
        ErrorCode.SECTION_UPDATE_ERROR,
        'Erro ao atualizar a seção',
        error as Error,
      );
    }
  }
}
