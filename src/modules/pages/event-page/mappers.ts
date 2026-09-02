import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { EventEntity } from './entities/event.entity';
import {
  EventMediaResponseDto,
  EventResponseDto,
} from './dto/event-response.dto';

/** Mapeia a mídia do evento para o contrato público. */
export function toEventMediaResponse(
  media: MediaItemEntity,
): EventMediaResponseDto {
  return {
    id: media.id,
    title: media.title,
    description: media.description,
    mediaType: media.mediaType,
    // O contrato antigo chamava este campo de `typeUpload`, diferente de todos
    // os outros módulos. Nenhum cliente lia o campo.
    uploadType: media.uploadType,
    url: media.url,
    isLocalFile: media.isLocalFile,
    platformType: media.platformType ?? undefined,
    originalName: media.originalName ?? undefined,
    size: media.size ?? undefined,
    createdAt: media.createdAt,
    updatedAt: media.updatedAt,
  };
}

/** Mapeia o evento e sua mídia para o contrato público. */
export function toEventResponse(
  event: EventEntity,
  media: MediaItemEntity | null,
): EventResponseDto {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    location: event.location,
    audience: event.audience,
    eventType: event.eventType,
    public: event.public,
    isRecurring: event.isRecurring,
    weekday: event.weekday ?? null,
    time: event.time ?? null,
    clubId: event.clubId ?? null,
    media: media ? toEventMediaResponse(media) : null,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}
