import { Injectable } from '@nestjs/common';

import {
  AppBusinessException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { ClubControlService } from 'src/modules/club-control/services/club-control.service';

import { PAGELA_PERIOD_YEAR_OFFSETS } from '../constants';
import { AcademicPeriod, AcademicWeek } from '../types';
import { periodCovers } from '../launch-window.utils';
import { getAcademicWeek, referenceYearOf } from '../utils';

/**
 * Converte a data do encontro na semana letiva correspondente.
 *
 * Criação e edição precisam da mesma conta, e ela depende do período letivo
 * cadastrado — por isso mora em um colaborador só, e não duplicada nos dois.
 */
@Injectable()
export class ResolvePagelaWeekService {
  constructor(private readonly clubControlService: ClubControlService) {}

  /**
   * Semana e ano da data, ou exceção explicando o que falta.
   *
   * `strict` distingue os dois usos: na criação, uma data fora do período é
   * erro do usuário; na edição de outros campos, é motivo para deixar semana e
   * ano como estão.
   */
  async resolve(referenceDate: string, strict: true): Promise<AcademicWeek>;
  async resolve(
    referenceDate: string,
    strict: false,
  ): Promise<AcademicWeek | null>;
  async resolve(
    referenceDate: string,
    strict: boolean,
  ): Promise<AcademicWeek | null> {
    const period = await this.findPeriodFor(referenceDate);

    if (!period) {
      if (!strict) return null;
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        `Não há período letivo cadastrado para a data ${referenceDate}. ` +
          'Cadastre um período letivo antes de criar pagelas.',
      );
    }

    const week = getAcademicWeek(referenceDate, period);

    if (!week) {
      if (!strict) return null;
      throw new AppBusinessException(
        ErrorCode.INVALID_DATE_RANGE,
        `Data ${referenceDate} está fora do período letivo ` +
          `(${period.startDate} a ${period.endDate})`,
      );
    }

    return week;
  }

  /**
   * Período letivo que cobre a data.
   *
   * O período costuma atravessar a virada do ano, então o ano da data também
   * pode estar cadastrado como o anterior ou o seguinte.
   */
  private async findPeriodFor(
    referenceDate: string,
  ): Promise<AcademicPeriod | null> {
    const year = referenceYearOf(referenceDate);
    let fallback: AcademicPeriod | null = null;

    for (const offset of PAGELA_PERIOD_YEAR_OFFSETS) {
      const found = await this.clubControlService.getPeriodByYear(
        year + offset,
      );
      if (!found) continue;

      const period: AcademicPeriod = {
        year: found.year,
        startDate: found.startDate,
        endDate: found.endDate,
      };
      // O primeiro encontrado nem sempre é o que cobre a data: em janeiro, o
      // período do ano novo pode existir e ainda não ter começado, enquanto o
      // do ano anterior segue em andamento.
      if (periodCovers(period, referenceDate)) return period;
      fallback ??= period;
    }

    return fallback;
  }
}
