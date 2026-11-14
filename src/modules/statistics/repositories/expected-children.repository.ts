import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { todayInAppTimezone } from 'src/shared/calendar-day/calendar-day.util';

import { ChildEntity } from '../../children/entities/child.entity';
import { ClubPeriodEntity } from '../../club-control/entities/club-period.entity';
import { ClubExceptionEntity } from '../../club-control/entities/club-exception.entity';
import { CHILD_DEACTIVATION_DAY_SQL } from '../constants';
import { StatisticsFiltersService } from '../services/statistics-filters.service';
import {
  ChildScopeFilters,
  ExceptionDay,
  ExpectedChildRow,
  ExpectedFilters,
  ExpectedSummary,
  ExpectedWeek,
  ExpectedWindow,
} from '../types';
import {
  listAcademicWeeks,
  summarizeExpected,
} from '../utils/enrollment.utils';

/** A criança como a consulta crua a devolve, antes de virar `ExpectedChildRow`. */
interface ExpectedChildRaw {
  id: string;
  clubId: string;
  clubWeekday: string;
  gender: string;
  birthDate: string;
  joinedAt: string | null;
  isActive: number | string | boolean;
  deactivationDay: string | null;
  city: string | null;
  state: string | null;
}

/**
 * O denominador da taxa de presença: quem era esperado, e em que dias.
 *
 * Junta as três coisas que a conta precisa — crianças (com o dia em que cada
 * uma entrou e saiu), períodos letivos e exceções de calendário — e entrega à
 * função pura `summarizeExpected`, que é onde a regra mora e é testada.
 *
 * As crianças vêm inteiras para a memória. É a mesma ordem de grandeza das
 * listagens que já fazem isso, e uma linha por criança, não por pagela.
 */
@Injectable()
export class ExpectedChildrenRepository {
  constructor(
    @InjectRepository(ChildEntity)
    private readonly childrenRepository: Repository<ChildEntity>,
    @InjectRepository(ClubPeriodEntity)
    private readonly periodsRepository: Repository<ClubPeriodEntity>,
    @InjectRepository(ClubExceptionEntity)
    private readonly exceptionsRepository: Repository<ClubExceptionEntity>,
    private readonly filtersService: StatisticsFiltersService,
  ) {}

  /**
   * Crianças de clubinho ativo, ativas ou não, com o dia de entrada e de saída.
   *
   * Inativas entram de propósito: quem saiu em novembro era esperada em março.
   * O dia de saída é resolvido no banco, com a mesma expressão que os filtros
   * históricos usam, para as duas contas nunca divergirem.
   */
  async findChildren(filters: ChildScopeFilters): Promise<ExpectedChildRow[]> {
    const query = this.childrenRepository
      .createQueryBuilder('child')
      .innerJoin('child.club', 'club')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .select('child.id', 'id')
      .addSelect('club.id', 'clubId')
      .addSelect('club.weekday', 'clubWeekday')
      .addSelect('child.gender', 'gender')
      .addSelect("DATE_FORMAT(child.birthDate, '%Y-%m-%d')", 'birthDate')
      .addSelect("DATE_FORMAT(child.joinedAt, '%Y-%m-%d')", 'joinedAt')
      .addSelect('child.isActive', 'isActive')
      .addSelect(
        `DATE_FORMAT(${CHILD_DEACTIVATION_DAY_SQL}, '%Y-%m-%d')`,
        'deactivationDay',
      )
      .addSelect('address.city', 'city')
      .addSelect('address.state', 'state');

    this.filtersService.applyChildScopeFilters(query, filters);

    const rows = await query.getRawMany<ExpectedChildRaw>();

    return rows.map((row) => {
      const isActive = Number(row.isActive) === 1 || row.isActive === true;

      return {
        id: row.id,
        clubId: row.clubId,
        clubWeekday: row.clubWeekday,
        gender: row.gender,
        birthDate: row.birthDate,
        joinedAt: row.joinedAt,
        isActive,
        // Criança ativa não tem dia de saída, mesmo que o cadastro guarde um
        // de uma desativação antiga.
        deactivationDay: isActive ? null : row.deactivationDay,
        city: row.city,
        state: row.state,
      };
    });
  }

  /** Semanas letivas dos períodos ativos, no recorte de ano e semana pedido. */
  async findWeeks(
    filters: Pick<ExpectedFilters, 'year' | 'week'>,
  ): Promise<ExpectedWeek[]> {
    const periods = await this.periodsRepository.find({
      where: filters.year
        ? { year: filters.year, isActive: true }
        : { isActive: true },
    });

    return periods
      .flatMap((period) => listAcademicWeeks(period))
      .filter((week) => !filters.week || week.week === filters.week);
  }

  /** Dias sem clubinho cadastrados (feriados, recessos). */
  async findExceptions(): Promise<ExceptionDay[]> {
    const exceptions = await this.exceptionsRepository.find({
      where: { isActive: true },
    });

    return exceptions.map((exception) => ({
      date: exception.exceptionDate,
      isRecurrent: exception.isRecurrent,
    }));
  }

  /**
   * Presenças esperadas no recorte, agrupadas pela chave escolhida.
   *
   * Sem período letivo no recorte o mapa volta vazio: não havia dia de
   * clubinho, então ninguém era esperado.
   */
  async summarize(
    filters: ExpectedFilters,
    keyOf: (child: ExpectedChildRow, week: ExpectedWeek) => string | null,
  ): Promise<Map<string, ExpectedSummary>> {
    const [children, weeks, exceptions] = await Promise.all([
      this.findChildren(filters),
      this.findWeeks(filters),
      this.findExceptions(),
    ]);

    const window: ExpectedWindow = {
      today: todayInAppTimezone(),
      startDate: filters.startDate,
      endDate: filters.endDate,
      exceptions,
    };

    return summarizeExpected(children, weeks, window, keyOf);
  }

  /**
   * O mesmo que `summarize`, para recortes de pagela.
   *
   * Com filtro de professor devolve `null`: quem lança a pagela não define
   * quem era esperado, então não existe "esperado do professor". Quem chama
   * cai na taxa sobre as pagelas lançadas (`presenceRateOrPerPagela`).
   */
  async summarizeForPagelas(
    filters: ExpectedFilters & { teacherId?: string },
    keyOf: (child: ExpectedChildRow, week: ExpectedWeek) => string | null,
  ): Promise<Map<string, ExpectedSummary> | null> {
    if (filters.teacherId) return null;

    return this.summarize(filters, keyOf);
  }
}
