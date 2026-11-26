import { Injectable } from '@nestjs/common';

import { AppBusinessException, ErrorCode } from 'src/shared/exceptions';
import { todayInAppTimezone } from 'src/shared/calendar-day/calendar-day.util';
import { ClubControlService } from 'src/modules/club-control/services/club-control.service';

import {
  PAGELA_PERIOD_MESSAGES,
  PAGELA_PERIOD_YEAR_OFFSETS,
} from '../constants';
import {
  launchClosedMessage,
  launchWindowOf,
  periodCovers,
} from '../launch-window.utils';
import {
  AcademicPeriod,
  AcademicWeek,
  OpenPagelaLaunchWindow,
  PagelaLaunchWindow,
  PagelaWeekRequest,
} from '../types';
import { getAcademicWeek, referenceYearOf } from '../utils';

/**
 * Guarda a regra "pagela só se lança dentro do período letivo".
 *
 * Antes a conferência só rodava quando o cliente omitia o ano ou a semana — e
 * o app manda os dois sempre, então nada era barrado. Agora criação e edição
 * passam por aqui, e o que decide é o dia de hoje no fuso do Clubinho, nunca a
 * data que o cliente informou.
 */
@Injectable()
export class PagelaLaunchWindowService {
  constructor(private readonly clubControlService: ClubControlService) {}

  /** A janela de hoje, aberta ou fechada. */
  async current(): Promise<PagelaLaunchWindow> {
    const today = todayInAppTimezone();

    return launchWindowOf(today, await this.periodsAround(today));
  }

  /** A janela de hoje, ou a recusa explicando por que está fechada. */
  async assertOpen(): Promise<OpenPagelaLaunchWindow> {
    const window = await this.current();

    if (!window.open) {
      throw new AppBusinessException(
        ErrorCode.ACADEMIC_PERIOD_CLOSED,
        launchClosedMessage(window),
      );
    }

    return window as OpenPagelaLaunchWindow;
  }

  /**
   * Semana e ano de uma pagela nova.
   *
   * A data precisa estar no período em andamento e não pode ser futura. A
   * semana informada vale, desde que já tenha acontecido; sem ela, sai da data.
   */
  async resolveForCreation(
    request: Required<Pick<PagelaWeekRequest, 'referenceDate'>> &
      PagelaWeekRequest,
  ): Promise<AcademicWeek> {
    const window = await this.assertOpen();
    this.assertDateIsLaunchable(request.referenceDate, window);

    const year = request.year ?? window.year;
    const week =
      request.week ?? this.weekOf(request.referenceDate, window).week;
    this.assertWeekIsLaunchable({ year, week }, window);

    return { year, week };
  }

  /**
   * Confere a edição de uma pagela existente.
   *
   * Fora do período letivo nada se edita. Dentro dele, o que já estava gravado
   * não é reavaliado — só o que a edição **muda**: uma pagela de um ano
   * anterior continua corrigível sem que a semana antiga dela seja recusada.
   *
   * Devolve a semana e o ano a gravar, ou `null` quando não mudam.
   */
  async resolveForUpdate(
    request: PagelaWeekRequest,
    stored: AcademicWeek & { referenceDate: string },
  ): Promise<AcademicWeek | null> {
    const window = await this.assertOpen();

    const dateChanged =
      request.referenceDate !== undefined &&
      request.referenceDate !== stored.referenceDate;
    if (dateChanged && request.referenceDate) {
      this.assertDateIsLaunchable(request.referenceDate, window);
    }

    const informed = request.year !== undefined || request.week !== undefined;
    const target: AcademicWeek = informed
      ? {
          year: request.year ?? stored.year,
          week: request.week ?? stored.week,
        }
      : dateChanged && request.referenceDate
        ? this.weekOf(request.referenceDate, window)
        : stored;

    if (target.year === stored.year && target.week === stored.week) return null;

    this.assertWeekIsLaunchable(target, window);

    return target;
  }

  private weekOf(
    referenceDate: string,
    window: OpenPagelaLaunchWindow,
  ): AcademicWeek {
    const week = getAcademicWeek(referenceDate, this.periodOf(window));
    if (!week) throw this.refusal(PAGELA_PERIOD_MESSAGES.DATE_OUTSIDE);

    return week;
  }

  private assertDateIsLaunchable(
    referenceDate: string,
    window: OpenPagelaLaunchWindow,
  ): void {
    if (referenceDate > window.today) {
      throw this.refusal(PAGELA_PERIOD_MESSAGES.FUTURE_DATE);
    }
    if (!periodCovers(this.periodOf(window), referenceDate)) {
      throw this.refusal(PAGELA_PERIOD_MESSAGES.DATE_OUTSIDE);
    }
  }

  private assertWeekIsLaunchable(
    target: AcademicWeek,
    window: OpenPagelaLaunchWindow,
  ): void {
    if (target.year !== window.year) {
      throw this.refusal(PAGELA_PERIOD_MESSAGES.YEAR_OUTSIDE);
    }
    if (target.week < 1 || target.week > window.currentWeek) {
      throw this.refusal(
        PAGELA_PERIOD_MESSAGES.WEEK_OUTSIDE.replace(
          '{current}',
          String(window.currentWeek),
        ),
      );
    }
  }

  private refusal(message: string): AppBusinessException {
    return new AppBusinessException(ErrorCode.INVALID_DATE_RANGE, message);
  }

  private periodOf(window: OpenPagelaLaunchWindow): AcademicPeriod {
    return {
      year: window.year,
      startDate: window.startDate,
      endDate: window.endDate,
    };
  }

  /**
   * Períodos ativos do ano de hoje e dos vizinhos.
   *
   * O período pode atravessar a virada do ano, e fora dele a mensagem precisa
   * do próximo ou do último — por isso os três anos.
   */
  private async periodsAround(today: string): Promise<AcademicPeriod[]> {
    const year = referenceYearOf(today);
    const found = await Promise.all(
      PAGELA_PERIOD_YEAR_OFFSETS.map((offset) =>
        this.clubControlService.getPeriodByYear(year + offset),
      ),
    );

    return found.flatMap((period) =>
      period
        ? [
            {
              year: period.year,
              startDate: period.startDate,
              endDate: period.endDate,
            },
          ]
        : [],
    );
  }
}
