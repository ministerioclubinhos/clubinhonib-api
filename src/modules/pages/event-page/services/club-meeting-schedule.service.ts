import { Inject, Injectable, forwardRef } from '@nestjs/common';

import { ClubControlService } from 'src/modules/club-control/services/club-control.service';

import { EventEntity } from '../entities/event.entity';
import {
  DateRange,
  ExceptionCalendar,
  PeriodWindow,
  expandOccurrences,
} from '../occurrences.util';

/**
 * Em que dias cada evento acontece.
 *
 * As datas dos encontros de clubinho não estão gravadas em lugar nenhum: elas
 * saem do cruzamento entre o dia da semana do clubinho, o período letivo e as
 * exceções, calculado a cada leitura. Cadastrar um período ou marcar um feriado
 * muda o calendário na consulta seguinte sem escrever uma linha em `events` —
 * e sem chance de duplicar encontro.
 *
 * Quem manda no período e nas exceções é o módulo de controle; aqui só se
 * pergunta a ele, uma vez por consulta, e aplica-se a regra sobre a lista
 * inteira de eventos.
 */
@Injectable()
export class ClubMeetingScheduleService {
  constructor(
    // O laço entre os módulos já existe: clubes depende da agenda para manter o
    // encontro, controle depende de clubes, e a agenda passa a depender de
    // controle para saber o período letivo.
    @Inject(forwardRef(() => ClubControlService))
    private readonly clubControlService: ClubControlService,
  ) {}

  /**
   * Datas de cada evento, por `id`.
   *
   * Uma consulta só ao controle para a lista toda: perguntar por evento
   * multiplicaria a mesma leitura de período e exceção por dezenas de
   * clubinhos.
   */
  async occurrencesByEvent(
    events: EventEntity[],
    range: DateRange = {},
  ): Promise<Map<string, string[]>> {
    const byEvent = new Map<string, string[]>();
    if (events.length === 0) return byEvent;

    const rules = await this.clubControlService.getCalendarRules();
    const periods: PeriodWindow[] = rules.periods;
    const exceptions = new ExceptionCalendar(rules.exceptions);

    for (const event of events) {
      byEvent.set(
        event.id,
        expandOccurrences(event, periods, exceptions, range),
      );
    }

    return byEvent;
  }
}
