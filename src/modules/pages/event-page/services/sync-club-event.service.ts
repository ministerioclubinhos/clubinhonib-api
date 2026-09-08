import { Injectable, Logger } from '@nestjs/common';
import { EventRepository } from '../repositories/event.repository';
import {
  EventAudience,
  EventEntity,
  EventType,
} from '../entities/event.entity';
import { ClubMeetingSource } from '../types';
import { formatClubLocation, nextOccurrence } from '../utils';
import { toDateKey } from '../occurrences.util';
import {
  CLUB_MEETING_TIME_FALLBACK,
  clubMeetingDescription,
  clubMeetingTitle,
} from '../constants';

/**
 * Mantém no calendário os dias de um clubinho.
 *
 * São eventos **não públicos**: dia, horário e endereço só aparecem para quem
 * está autenticado. O registro é único por clubinho — uma edição de dia ou
 * horário atualiza a mesma linha, nunca cria outra, e a unicidade de `club_id`
 * garante isso no banco, não só aqui.
 *
 * A linha guarda apenas a **definição** da recorrência: dia da semana, horário
 * e desde quando ela vale. As datas em que o clubinho de fato acontece saem do
 * período letivo e das exceções na hora da leitura, então este serviço não
 * precisa saber que o período existe — e cadastrar um período depois não exige
 * regravar nada.
 *
 * **Clubinho inativo não tem dia nenhum no calendário.** Desativar apaga a
 * linha, e com ela todas as datas; reativar cria de novo, valendo a partir do
 * dia da reativação. Quem guarda o que aconteceu semana a semana é o controle
 * de pagela (`club_control_logs`); o calendário mostra o que vale agora.
 *
 * Não dispara aviso por e-mail: o dia de clubinho é operacional e nasce de um
 * cadastro administrativo, não é novidade da agenda para toda a base.
 */
@Injectable()
export class SyncClubEventService {
  private readonly logger = new Logger(SyncClubEventService.name);

  constructor(private readonly eventRepo: EventRepository) {}

  /**
   * Cria ou atualiza os dias do clubinho. Um clubinho inativo perde todos
   * eles.
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
      this.logger.log(`Dias do clubinho #${club.number} atualizados.`);
      return saved;
    }

    const created = await this.eventRepo.createEvent(content);
    this.logger.log(`Dias do clubinho #${club.number} criados.`);
    return created;
  }

  /**
   * Tira do calendário todos os dias do clubinho.
   *
   * Chamado ao desativar e ao excluir o clubinho. Na exclusão vem antes de
   * apagar o clubinho: depois dela não há mais de onde tirar o vínculo.
   */
  async removeForClub(clubId: string): Promise<void> {
    await this.eventRepo.removeByClubId(clubId);
    this.logger.log(`Dias do clubinho removidos do calendário. ID=${clubId}`);
  }

  private buildContent(club: ClubMeetingSource, existing: EventEntity | null) {
    return {
      title: clubMeetingTitle(club.number),
      description: clubMeetingDescription(club.number),
      location: formatClubLocation(club.address),
      date: this.firstOccurrence(club, existing),
      audience: EventAudience.ALL,
      eventType: EventType.VISIT,
      public: false,
      isRecurring: true,
      weekday: club.weekday,
      time: club.time ?? null,
      clubId: club.id,
    };
  }

  /**
   * Desde quando a recorrência vale.
   *
   * Mudar o dia da semana muda todas as datas, então ela recomeça a partir de
   * hoje — manter a data antiga faria o calendário afirmar que o clubinho já se
   * reunia na quarta desde março, o que nunca aconteceu. Com o mesmo dia da
   * semana a data é preservada: mexer no horário ou no endereço não muda desde
   * quando o clubinho existe.
   *
   * Um clubinho reativado não tem linha nenhuma — a desativação apagou —, então
   * ele cai no `nextOccurrence` e volta a valer a partir de hoje.
   *
   * A data não é comparada com o período letivo aqui. Ela é só o piso da série;
   * o teto e a janela vêm do período na hora da leitura, e é isso que faz um
   * clubinho cadastrado sem período nenhum aparecer sozinho no calendário
   * quando o período for cadastrado depois.
   */
  private firstOccurrence(
    club: ClubMeetingSource,
    existing: EventEntity | null,
  ): string {
    if (existing && existing.weekday === club.weekday) {
      return toDateKey(existing.date);
    }

    return nextOccurrence(club.weekday);
  }

  /** Horário exibido quando o clubinho não tem um cadastrado. */
  static displayTime(time?: string | null): string {
    return time?.trim() ? time : CLUB_MEETING_TIME_FALLBACK;
  }
}
