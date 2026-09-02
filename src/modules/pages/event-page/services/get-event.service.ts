import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { EventRepository } from '../repositories/event.repository';
import { EventEntity } from '../entities/event.entity';
import { EventResponseDto } from '../dto/event-response.dto';
import { toEventResponse } from '../mappers';
import { toEventDay, todayAtMidnight } from '../utils';
import { EVENT_MEDIA_TARGET_TYPE } from '../constants';

@Injectable()
export class GetEventService {
  private readonly logger = new Logger(GetEventService.name);

  constructor(
    private readonly eventRepo: EventRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  /** Carrega o evento ou falha com o erro documentado. */
  async findEntityOrFail(id: string): Promise<EventEntity> {
    const event = await this.eventRepo.findById(id);
    if (!event) {
      this.logger.warn(`Evento não encontrado. ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.EVENT_NOT_FOUND,
        'Evento não encontrado',
      );
    }
    return event;
  }

  /** Mídia do evento, quando existe. */
  async findMediaOf(eventId: string): Promise<MediaItemEntity | null> {
    return this.mediaItemProcessor.findMediaItemByTarget(
      eventId,
      EVENT_MEDIA_TARGET_TYPE,
    );
  }

  /**
   * Agenda completa. `includePrivate` chega decidido pelo controller, que é
   * quem enxerga a requisição: o caso de uso só aplica a regra.
   */
  async findAll(includePrivate: boolean): Promise<EventResponseDto[]> {
    return this.toResponses(await this.eventRepo.findAll(includePrivate));
  }

  async findOne(id: string): Promise<EventResponseDto> {
    const event = await this.findEntityOrFail(id);
    return toEventResponse(event, await this.findMediaOf(event.id));
  }

  /**
   * Eventos de hoje em diante. Um encontro semanal nunca sai da lista: ele se
   * repete, então continua valendo mesmo com a data da primeira ocorrência no
   * passado.
   */
  async findUpcoming(includePrivate: boolean): Promise<EventResponseDto[]> {
    const today = todayAtMidnight();
    const events = await this.eventRepo.findAll(includePrivate);

    return this.toResponses(
      events.filter(
        (event) => event.isRecurring || toEventDay(event.date) >= today,
      ),
    );
  }

  /** Monta as respostas buscando as mídias de todos os eventos de uma vez. */
  private async toResponses(
    events: EventEntity[],
  ): Promise<EventResponseDto[]> {
    if (events.length === 0) return [];

    const mediaItems =
      await this.mediaItemProcessor.findManyMediaItemsByTargets(
        events.map((event) => event.id),
        EVENT_MEDIA_TARGET_TYPE,
      );

    // Um evento tem no máximo uma mídia; a primeira encontrada é a dele.
    const mediaByEvent = new Map<string, MediaItemEntity>();
    for (const media of mediaItems) {
      if (!mediaByEvent.has(media.targetId)) {
        mediaByEvent.set(media.targetId, media);
      }
    }

    return events.map((event) =>
      toEventResponse(event, mediaByEvent.get(event.id) ?? null),
    );
  }
}
