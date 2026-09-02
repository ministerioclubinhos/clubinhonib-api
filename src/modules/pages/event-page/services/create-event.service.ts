import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { EventRepository } from '../repositories/event.repository';
import { CreateEventDto } from '../dto/create-event.dto';
import { EventResponseDto } from '../dto/event-response.dto';
import {
  EventAudience,
  EventEntity,
  EventType,
} from '../entities/event.entity';
import { toEventResponse } from '../mappers';
import { AnnounceEventService } from './announce-event.service';
import { EVENT_FILE_FIELD, EVENT_MEDIA_TARGET_TYPE } from '../constants';

@Injectable()
export class CreateEventService {
  private readonly logger = new Logger(CreateEventService.name);

  constructor(
    private readonly eventRepo: EventRepository,
    private readonly s3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly announceService: AnnounceEventService,
  ) {}

  async create(
    dto: CreateEventDto,
    file?: Express.Multer.File,
  ): Promise<EventResponseDto> {
    // O arquivo sobe antes da mídia ser gravada: o rastreador permite apagá-lo
    // do bucket quando a criação falha depois do upload.
    const uploads = new S3UploadTracker((uploaded: Express.Multer.File) =>
      this.s3Service.upload(uploaded),
    );

    let savedEvent: EventEntity | null = null;

    try {
      savedEvent = await this.eventRepo.createEvent({
        title: dto.title,
        date: dto.date,
        location: dto.location,
        description: dto.description,
        audience: dto.audience ?? EventAudience.ALL,
        eventType: dto.eventType ?? EventType.CUSTOM,
      });
      this.logger.log(`Evento criado. ID=${savedEvent.id}`);

      const media = await this.persistMedia(savedEvent, dto, uploads, file);

      this.announceService.announceInBackground('created', savedEvent);

      return toEventResponse(savedEvent, media);
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3Service.delete(url),
      );

      this.logger.error(
        'Erro ao criar evento.',
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro ao criar o evento.',
        error as Error,
      );
    }
  }

  /** Grava a mídia do evento, quando o payload trouxe uma. */
  private async persistMedia(
    event: EventEntity,
    dto: CreateEventDto,
    uploads: S3UploadTracker,
    file?: Express.Multer.File,
  ) {
    if (!dto.media && !file) return null;

    const isLocalFile = dto.media?.isLocalFile ?? Boolean(file);
    let url = dto.media?.url?.trim() ?? '';
    let originalName = dto.media?.originalName;
    let size = dto.media?.size;

    if (isLocalFile && file) {
      url = await uploads.upload(file);
      originalName = file.originalname;
      size = file.size;
    }

    const media = this.mediaItemProcessor.buildBaseMediaItem(
      {
        title: dto.media?.title || dto.title,
        description: dto.media?.description || `Imagem do evento: ${dto.title}`,
        mediaType: dto.media?.mediaType ?? MediaType.IMAGE,
        uploadType: dto.media?.uploadType,
        platformType: dto.media?.platformType ?? null,
        fileField: EVENT_FILE_FIELD,
        isLocalFile,
        url,
        originalName,
        size,
      },
      event.id,
      EVENT_MEDIA_TARGET_TYPE,
    );

    return this.mediaItemProcessor.saveMediaItem(media);
  }
}
