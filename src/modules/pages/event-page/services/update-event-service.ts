import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  AppInternalException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { DataSource } from 'typeorm';
import { EventRepository } from '../event.repository';
import { EventEntity } from '../entities/event.entity';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { S3UploadTracker } from 'src/shared/media/s3-upload-tracker';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { UpdateEventDto } from '../dto/update-event.dto';

@Injectable()
export class UpdateEventService {
  private readonly logger = new Logger(UpdateEventService.name);

  constructor(
    private readonly eventRepo: EventRepository,
    private readonly dataSource: DataSource,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly s3Service: AwsS3Service,
  ) {}

  async update(
    id: string,
    dto: UpdateEventDto & { isLocalFile?: boolean },
    file?: Express.Multer.File,
  ): Promise<EventEntity> {
    this.logger.log(`🛠️ Atualizando evento ID=${id}`);

    const existing = await this.eventRepo.findById(id);
    if (!existing)
      throw new AppNotFoundException(
        ErrorCode.EVENT_NOT_FOUND,
        'Evento não encontrado',
      );

    // O arquivo sobe fora da transação: o rastreador permite apagá-lo do
    // bucket quando a atualização falha depois do upload.
    const uploads = new S3UploadTracker((uploaded: Express.Multer.File) =>
      this.s3Service.upload(uploaded),
    );

    try {
      const savedEvent = await this.dataSource.transaction(async (manager) => {
        const updatedEvent = manager.merge(EventEntity, existing, {
          title: dto.title ?? existing.title,
          description: dto.description ?? existing.description,
          location: dto.location ?? existing.location,
          date: dto.date ?? existing.date,
        });

        const saved = await manager.save(EventEntity, updatedEvent);
        this.logger.log(`✅ Evento atualizado: ${saved.id}`);
        return saved;
      });

      if (dto.media) {
        await this.syncMedia(savedEvent, dto, uploads, file);
      }

      return savedEvent;
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
   * Substitui a mídia do evento. A troca acontece depois do commit: o
   * processador sobe o arquivo novo antes de apagar o antigo e só remove do S3
   * o que deixou de ser referenciado.
   */
  private async syncMedia(
    event: EventEntity,
    dto: UpdateEventDto & { isLocalFile?: boolean },
    uploads: S3UploadTracker,
    file?: Express.Multer.File,
  ): Promise<void> {
    const media = dto.media;
    if (!media) return;

    const fieldKey = media.fieldKey ?? 'file';
    const filesDict = file ? { [fieldKey]: file } : {};

    const existingMedia = await this.mediaItemProcessor.findMediaItemsByTarget(
      event.id,
      MediaTargetType.Event,
    );

    const [mediaEntity] =
      await this.mediaItemProcessor.cleanAndReplaceMediaItems(
        [
          {
            id: media.id ?? existingMedia[0]?.id,
            title: media.title ?? event.title,
            description: media.description ?? `Mídia do evento: ${event.title}`,
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
        MediaTargetType.Event,
        filesDict,
        existingMedia,
        (url: string) => this.s3Service.delete(url),
        uploads.upload,
      );

    this.logger.log(`📎 Mídia atualizada: ${mediaEntity?.title ?? ''}`);
  }
}
