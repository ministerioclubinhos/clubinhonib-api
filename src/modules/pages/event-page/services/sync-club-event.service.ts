import { Injectable, Logger } from '@nestjs/common';
import { EventRepository } from '../repositories/event.repository';
import {
  EventAudience,
  EventEntity,
  EventType,
} from '../entities/event.entity';
import { ClubMeetingSource } from '../types';
import { formatClubLocation, nextOccurrence } from '../utils';
import {
  CLUB_MEETING_TIME_FALLBACK,
  clubMeetingDescription,
  clubMeetingTitle,
} from '../constants';

/**
 * Mantém no calendário um encontro semanal por clubinho.
 *
 * É um evento recorrente e **não público**: dia, horário e endereço só
 * aparecem para quem está autenticado. O registro é único por clubinho — uma
 * edição de dia ou horário atualiza a mesma linha, nunca cria outra.
 *
 * Não dispara aviso por e-mail: o encontro é operacional e nasce de um cadastro
 * administrativo, não é novidade da agenda para toda a base.
 */
@Injectable()
export class SyncClubEventService {
  private readonly logger = new Logger(SyncClubEventService.name);

  constructor(private readonly eventRepo: EventRepository) {}

  /**
   * Cria ou atualiza o encontro do clubinho. Um clubinho inativo perde o
   * encontro do calendário.
   */
  async syncFromClub(club: ClubMeetingSource): Promise<EventEntity | null> {
    if (!club.isActive) {
      await this.removeForClub(club.id);
      return null;
    }

    const existing = await this.eventRepo.findByClubId(club.id);
    const content = this.buildContent(club, existing);

    if (existing) {
      Object.assign(existing, content);
      const saved = await this.eventRepo.saveEvent(existing);
      this.logger.log(`Encontro do clubinho #${club.number} atualizado.`);
      return saved;
    }

    const created = await this.eventRepo.createEvent(content);
    this.logger.log(`Encontro do clubinho #${club.number} criado.`);
    return created;
  }

  /** Tira o encontro do calendário quando o clubinho sai ou é desativado. */
  async removeForClub(clubId: string): Promise<void> {
    await this.eventRepo.removeByClubId(clubId);
  }

  private buildContent(club: ClubMeetingSource, existing: EventEntity | null) {
    return {
      title: clubMeetingTitle(club.number),
      description: clubMeetingDescription(club.number),
      location: formatClubLocation(club.address),
      // A data marca a primeira ocorrência; a repetição vem de weekday e time.
      // Em uma atualização ela é preservada: mexer no horário não deve mudar
      // desde quando o encontro existe.
      date: existing?.date ?? nextOccurrence(club.weekday),
      audience: EventAudience.ALL,
      eventType: EventType.VISIT,
      public: false,
      isRecurring: true,
      weekday: club.weekday,
      time: club.time ?? null,
      clubId: club.id,
    };
  }

  /** Horário exibido quando o clubinho não tem um cadastrado. */
  static displayTime(time?: string | null): string {
    return time?.trim() ? time : CLUB_MEETING_TIME_FALLBACK;
  }
}
