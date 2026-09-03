import { Injectable } from '@nestjs/common';

import {
  AppBusinessException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { ClubControlService } from 'src/modules/club-control/services/club-control.service';

import { PAGELA_PERIOD_YEAR_OFFSETS } from '../constants';
import { AcademicPeriod, AcademicWeek } from '../types';
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

    for (const offset of PAGELA_PERIOD_YEAR_OFFSETS) {
      const period = await this.clubControlService.getPeriodByYear(
        year + offset,
      );
      if (period) {
        return {
          year: period.year,
          startDate: period.startDate,
          endDate: period.endDate,
        };
      }
    }

    return null;
  }
}
