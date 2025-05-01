import {
    Injectable,
    Logger,
    BadRequestException,
    NotFoundException,
  } from '@nestjs/common';
  import { DataSource } from 'typeorm';
  import { EventRepository } from '../event.repository';
  import { EventEntity } from '../entities/event.entity';
  import { AwsS3Service } from 'src/aws/aws-s3.service';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { MediaTargetType } from 'src/share/media/media-target-type.enum';
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
      if (!existing) throw new NotFoundException('Evento não encontrado');
  
      return await this.dataSource.transaction(async (manager) => {
        const updatedEvent = manager.merge(EventEntity, existing, {
          title: dto.title ?? existing.title,
          description: dto.description ?? existing.description,
          location: dto.location ?? existing.location,
          date: dto.date ?? existing.date,
        });
  
        const savedEvent = await manager.save(EventEntity, updatedEvent);
        this.logger.log(`✅ Evento atualizado: ${savedEvent.id}`);
  
        if (dto.media) {
          const mediaItemsInput = [
            {
              id: dto.media.id,
              title: dto.media.title ?? savedEvent.title,
              description: dto.media.description ?? `Mídia do evento: ${savedEvent.title}`,
              mediaType: dto.media.mediaType,
              uploadType: dto.media.uploadType,
              platformType: dto.media.isLocalFile ? null : dto.media.platformType,
              url: dto.media.url,
              originalName: dto.media.originalName,
              size: dto.media.size,
              isLocalFile: dto.media.isLocalFile,
              fileField: dto.media.fieldKey ?? 'file',
              public: false
            },
          ];
  
          const filesDict = file ? { [dto.media.fieldKey ?? 'file']: file } : {};
          const existingMedia = await this.mediaItemProcessor.findMediaItemsByTarget(
            savedEvent.id,
            MediaTargetType.Event,
          );
  
          const [mediaEntity] = await this.mediaItemProcessor.cleanAndReplaceMediaItems(
            mediaItemsInput,
            savedEvent.id,
            MediaTargetType.Event,
            filesDict,
            existingMedia,
            (url) => this.s3Service.delete(url),
            (file) => this.s3Service.upload(file),
          );
  
          this.logger.log(`📎 Mídia atualizada: ${mediaEntity.title}`);
        }
  
        return savedEvent;
      });
    }
  }
  