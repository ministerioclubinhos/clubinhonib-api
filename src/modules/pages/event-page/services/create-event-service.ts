import { Injectable, Logger } from '@nestjs/common';
import {
  AppValidationException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { EventRepository } from '../event.repository';
import { EventEntity } from '../entities/event.entity';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { CreateEventDto } from '../dto/create-event.dto';

@Injectable()
export class CreateEventService {
  private readonly logger = new Logger(CreateEventService.name);

  constructor(
    private readonly eventRepo: EventRepository,
    private readonly s3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async create(
    dto: CreateEventDto,
    file?: Express.Multer.File,
  ): Promise<EventEntity> {
    // O arquivo sobe antes da mídia ser gravada: o rastreador permite apagá-lo
    // do bucket quando a criação falha depois do upload.
    const uploads = new S3UploadTracker((uploaded: Express.Multer.File) =>
      this.s3Service.upload(uploaded),
    );

    try {
      const event = this.eventRepo.create({
        title: dto.title,
        date: dto.date,
        location: dto.location,
        description: dto.description,
      });

      const savedEvent = await this.eventRepo.save(event);
      this.logger.log(`✅ Evento salvo: ID=${savedEvent.id}`);

      let mediaUrl = dto.media.url?.trim() || '';
      let originalName = dto.media.originalName;
      let size = dto.media.size;

      if (dto.media.isLocalFile) {
        if (!file)
          throw new AppValidationException(
            ErrorCode.FILE_REQUIRED,
            'Arquivo não enviado.',
          );
        mediaUrl = await uploads.upload(file);
        originalName = file.originalname;
        size = file.size;
        this.logger.log(`⬆️ Upload de mídia concluído: ${mediaUrl}`);
      }

      const mediaEntity = this.mediaItemProcessor.buildBaseMediaItem(
        {
          title: dto.media.title,
          description: dto.media.description,
          mediaType: dto.media.mediaType ?? MediaType.IMAGE,
          uploadType: dto.media.uploadType,
          platformType: dto.media.platformType ?? null,
          fileField: 'file',
          isLocalFile: dto.media.isLocalFile,
          url: mediaUrl,
          originalName,
          size,
        },
        savedEvent.id,
        MediaTargetType.Event,
      );

      await this.mediaItemProcessor.saveMediaItem(mediaEntity);
      this.logger.log(`🎞️ Mídia salva para evento`);

      return savedEvent;
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3Service.delete(url),
      );

      const errStack = error instanceof Error ? error.stack : undefined;
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error('❌ Erro ao criar evento', errStack);
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        errMsg || 'Erro inesperado ao criar evento.',
      );
    }
  }
}
