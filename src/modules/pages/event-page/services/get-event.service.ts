import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { EventRepository } from '../repositories/event.repository';
import { EventEntity } from '../entities/event.entity';
import { EventResponseDto } from '../dto/event-response.dto';
import { toEventResponse } from '../mappers';
import { DateRange, todayKey } from '../occurrences.util';
import { EVENT_MEDIA_TARGET_TYPE } from '../constants';
import { ClubMeetingScheduleService } from './club-meeting-schedule.service';

@Injectable()
export class GetEventService {
  private readonly logger = new Logger(GetEventService.name);

  constructor(
    private readonly eventRepo: EventRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly scheduleService: ClubMeetingScheduleService,
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
  async findAll(
    includePrivate: boolean,
    range: DateRange = {},
  ): Promise<EventResponseDto[]> {
    return this.toResponses(
      await this.eventRepo.findAll(includePrivate),
      range,
    );
  }

  async findOne(id: string): Promise<EventResponseDto> {
    const event = await this.findEntityOrFail(id);
    const occurrences = await this.scheduleService.occurrencesByEvent([event]);

    return toEventResponse(
      event,
      await this.findMediaOf(event.id),
      occurrences.get(event.id) ?? [],
    );
  }

  /**
   * Eventos de hoje em diante.
   *
   * Um encontro de clubinho fica na lista enquanto ainda tiver alguma data pela
   * frente — o que depende do período letivo, não da data da primeira
   * ocorrência. Antes, todo evento recorrente permanecia para sempre: em
   * janeiro, com o ano letivo encerrado, os clubinhos continuavam aparecendo
   * como se houvesse encontro na semana seguinte.
   */
  async findUpcoming(
    includePrivate: boolean,
    range: DateRange = {},
  ): Promise<EventResponseDto[]> {
    const events = await this.eventRepo.findAll(includePrivate);
    const today = todayKey();

    // Um `from` anterior a hoje não faz "próximos eventos" olhar para trás.
    return this.toResponses(events, {
      ...range,
      from: range.from && range.from > today ? range.from : today,
    });
  }

  /**
   * Monta as respostas buscando as mídias de todos os eventos de uma vez.
   *
   * Evento sem nenhuma data no recorte fica de fora. Para um encontro de
   * clubinho isso é a regra do período letivo em ação: sem período cadastrado
   * para o ano, nenhum dia de clubinho existe e o encontro não vai para a
   * agenda.
   */
  private async toResponses(
    events: EventEntity[],
    range: DateRange = {},
  ): Promise<EventResponseDto[]> {
    if (events.length === 0) return [];

    const [mediaItems, occurrencesByEvent] = await Promise.all([
      this.mediaItemProcessor.findManyMediaItemsByTargets(
        events.map((event) => event.id),
        EVENT_MEDIA_TARGET_TYPE,
      ),
      this.scheduleService.occurrencesByEvent(events, range),
    ]);

    // Um evento tem no máximo uma mídia; a primeira encontrada é a dele.
    const mediaByEvent = new Map<string, MediaItemEntity>();
    for (const media of mediaItems) {
      if (!mediaByEvent.has(media.targetId)) {
        mediaByEvent.set(media.targetId, media);
      }
    }

    return events
      .map((event) =>
        toEventResponse(
          event,
          mediaByEvent.get(event.id) ?? null,
          occurrencesByEvent.get(event.id) ?? [],
        ),
      )
      .filter((event) => event.occurrences.length > 0);
  }
}
