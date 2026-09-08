import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { EventRepository } from '../repositories/event.repository';
import { UpdateEventDto } from '../dto/update-event.dto';
import { EventResponseDto } from '../dto/event-response.dto';
import { EventEntity } from '../entities/event.entity';
import { toEventResponse } from '../mappers';
import { GetEventService } from './get-event.service';
import { AnnounceEventService } from './announce-event.service';
import { ClubMeetingScheduleService } from './club-meeting-schedule.service';
import { EVENT_FILE_FIELD, EVENT_MEDIA_TARGET_TYPE } from '../constants';
import { assertNotClubMeeting } from '../utils';

@Injectable()
export class UpdateEventService {
  private readonly logger = new Logger(UpdateEventService.name);

  constructor(
    private readonly eventRepo: EventRepository,
    private readonly getService: GetEventService,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly s3Service: AwsS3Service,
    private readonly announceService: AnnounceEventService,
    private readonly scheduleService: ClubMeetingScheduleService,
  ) {}

  async update(
    id: string,
    dto: UpdateEventDto,
    file?: Express.Multer.File,
  ): Promise<EventResponseDto> {
    const existing = await this.getService.findEntityOrFail(id);
    assertNotClubMeeting(existing);

    // O arquivo sobe fora da gravação: o rastreador permite apagá-lo do bucket
    // quando a atualização falha depois do upload.
    const uploads = new S3UploadTracker((uploaded: Express.Multer.File) =>
      this.s3Service.upload(uploaded),
    );

    try {
      // Só os campos enviados mudam; o resto do evento fica como está.
      existing.title = dto.title ?? existing.title;
      existing.description = dto.description ?? existing.description;
      existing.location = dto.location ?? existing.location;
      existing.date = dto.date ?? existing.date;
      existing.audience = dto.audience ?? existing.audience;
      existing.eventType = dto.eventType ?? existing.eventType;

      const savedEvent = await this.eventRepo.saveEvent(existing);
      this.logger.log(`Evento atualizado. ID=${savedEvent.id}`);

      if (dto.media) {
        await this.syncMedia(savedEvent, dto, uploads, file);
      }

      this.announceService.announceInBackground('updated', savedEvent);

      return toEventResponse(
        savedEvent,
        await this.getService.findMediaOf(id),
        await this.occurrencesOf(savedEvent),
      );
    } catch (error: unknown) {
      await this.mediaItemProcessor.discardUnreferencedUploads(
        uploads.uploadedUrls,
        (url: string) => this.s3Service.delete(url),
      );

      this.logger.error(
        `Erro ao atualizar evento. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro ao atualizar o evento.',
        error as Error,
      );
    }
  }

  /**
   * Substitui a mídia do evento. O processador sobe o arquivo novo antes de
   * apagar o antigo e só remove do S3 o que deixou de ser referenciado.
   */
  private async syncMedia(
    event: EventEntity,
    dto: UpdateEventDto,
    uploads: S3UploadTracker,
    file?: Express.Multer.File,
  ): Promise<void> {
    const media = dto.media;
    if (!media) return;

    const fieldKey = media.fieldKey ?? EVENT_FILE_FIELD;
    const filesDict = file ? { [fieldKey]: file } : {};

    const existingMedia = await this.mediaItemProcessor.findMediaItemsByTarget(
      event.id,
      EVENT_MEDIA_TARGET_TYPE,
    );

    await this.mediaItemProcessor.cleanAndReplaceMediaItems(
      [
        {
          id: media.id ?? existingMedia[0]?.id,
          title: media.title ?? event.title,
          description: media.description ?? `Imagem do evento: ${event.title}`,
          mediaType: media.mediaType,
          uploadType: media.uploadType,
          platformType: media.isLocalFile ? null : media.platformType,
          url: media.url,
          originalName: media.originalName,
          size: media.size,
          isLocalFile: media.isLocalFile,
          fileField: fieldKey,
        },
      ],
      event.id,
      EVENT_MEDIA_TARGET_TYPE,
      filesDict,
      existingMedia,
      (url: string) => this.s3Service.delete(url),
      uploads.upload,
    );
  }

  /**
   * Em que dias o evento acontece, para a resposta.
   *
   * Sem isto o corpo do `POST`/`PATCH` voltava com `occurrences` vazio — que no
   * contrato significa "não acontece em dia nenhum". A tela recarrega a agenda
   * depois de salvar e não chegava a mostrar o erro, mas qualquer cliente que
   * lesse a resposta veria um evento sem data.
   */
  private async occurrencesOf(event: EventEntity): Promise<string[]> {
    const byEvent = await this.scheduleService.occurrencesByEvent([event]);
    return byEvent.get(event.id) ?? [];
  }
}
