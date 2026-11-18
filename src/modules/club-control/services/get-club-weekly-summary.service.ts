import { Injectable, Logger } from '@nestjs/common';

import { AccessContext, UserRole } from 'src/core/auth/auth.types';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { ClubSimpleResponseDto } from 'src/modules/clubs/dto/club.response.dto';
import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import { GetClubsService } from 'src/modules/clubs/services/get-clubs.service';
import {
  AppForbiddenException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';

import { ClubWeekStatus, ClubWeekTimeline } from '../constants';
import { SummaryChildRaw, SummaryPagelaRaw } from '../dto/club-control-raw.dto';
import { ClubWeeklySummaryQueryDto } from '../dto/club-weekly-summary-query.dto';
import {
  ClubWeeklySummaryCellDto,
  ClubWeeklySummaryClubDto,
  ClubWeeklySummaryDto,
  ClubWeeklySummaryWeekDto,
} from '../dto/club-weekly-summary.dto';
import { ClubPeriodEntity } from '../entities/club-period.entity';
import { ClubControlRepository } from '../repositories/club-control.repository';
import { ClubWeekException } from '../types';
import {
  countStatuses,
  countsOf,
  emptyCounts,
  findExceptionForDate,
  highlightsOf,
  isChildCountedOn,
  sumCounts,
  toClubWeekStatus,
  weekTimelineOf,
} from '../weekly-summary.utils';
import { AcademicWeekService } from './academic-week.service';
import { ClubStatusService } from './club-status.service';

/**
 * O resumo semanal dos clubinhos de quem está pedindo.
 *
 * É a tela que o e-mail de segunda-feira abre. O e-mail conta a semana que
 * fechou; aqui está o período letivo inteiro — uma linha por semana, uma
 * célula por clubinho —, que é o que responde "e nas semanas anteriores?".
 *
 * O alcance vem do módulo de clubinhos: um coordenador enxerga os clubinhos
 * dele, um administrador enxerga todos. Nenhum id chega do cliente para
 * ampliar isso — `clubId` só recorta o conjunto que a sessão já enxergava.
 *
 * O levantamento é feito em três consultas para o período todo, e não em uma
 * por célula: `ClubWeekCheckService.checkClubWeek` custa quatro consultas por
 * clubinho e por semana, e o quadro tem dezenas de semanas.
 */
@Injectable()
export class GetClubWeeklySummaryService {
  private readonly logger = new Logger(GetClubWeeklySummaryService.name);

  constructor(
    private readonly clubControlRepository: ClubControlRepository,
    private readonly academicWeekService: AcademicWeekService,
    private readonly clubStatusService: ClubStatusService,
    private readonly getClubsService: GetClubsService,
    private readonly featureFlags: GetFeatureFlagsService,
  ) {}

  async getSummary(
    context: AccessContext,
    query: ClubWeeklySummaryQueryDto,
  ): Promise<ClubWeeklySummaryDto> {
    await this.assertFeatureEnabled(context.role);

    const clubs = await this.resolveClubs(context, query.clubId);
    const periods = await this.clubControlRepository.findActivePeriods();
    const availableYears = [
      ...new Set(periods.map((period) => period.year)),
    ].sort((a, b) => b - a);

    const current =
      await this.academicWeekService.calculateCurrentAcademicWeek();
    const year =
      query.year ??
      current?.academicYear ??
      availableYears[0] ??
      new Date().getFullYear();

    const period = await this.clubControlRepository.findPeriodByYear(year);

    if (!period) {
      this.logger.log(
        `Resumo semanal ${year}: sem período letivo cadastrado, ${clubs.length} clubinho(s) no alcance.`,
      );
      return {
        year,
        availableYears,
        currentWeek: null,
        period: null,
        clubs: clubs.map(toSummaryClub),
        weeks: [],
        highlights: highlightsOf([]),
      };
    }

    const currentWeek =
      current?.isWithinPeriod && current.academicYear === year
        ? current.academicWeek
        : null;

    const weeks = await this.buildWeeks(period, clubs, currentWeek);

    return {
      year,
      availableYears,
      currentWeek,
      period: {
        year: period.year,
        startDate: period.startDate,
        endDate: period.endDate,
        totalWeeks: weeks.length,
      },
      clubs: clubs.map(toSummaryClub),
      weeks,
      highlights: highlightsOf(weeks),
    };
  }

  /** Barra o acesso quando o recurso está desligado para o perfil. */
  private async assertFeatureEnabled(role?: UserRole): Promise<void> {
    const enabled = await this.featureFlags.isEnabled(
      FeatureFlagKeys.CLUB_WEEKLY_SUMMARY,
      role ?? null,
    );

    if (!enabled) {
      throw new AppForbiddenException(
        ErrorCode.FEATURE_DISABLED,
        'O resumo semanal dos clubinhos está indisponível',
      );
    }
  }

  /**
   * Os clubinhos do recorte, opcionalmente reduzidos a um.
   *
   * Um `clubId` fora do alcance de quem pediu responde "não encontrado", e não
   * uma lista vazia: a resposta é a mesma que ele receberia para um clubinho
   * inexistente, e é assim que a tela não vira um mapa de quais ids existem.
   */
  private async resolveClubs(
    context: AccessContext,
    clubId?: string,
  ): Promise<ClubSimpleResponseDto[]> {
    const clubs = await this.getClubsService.findAllSimple(context);

    if (!clubId) return clubs;

    const chosen = clubs.filter((club) => club.id === clubId);

    if (chosen.length === 0) {
      throw new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      );
    }

    return chosen;
  }

  /** Uma linha por semana letiva, com uma célula por clubinho. */
  private async buildWeeks(
    period: ClubPeriodEntity,
    clubs: ClubSimpleResponseDto[],
    currentWeek: number | null,
  ): Promise<ClubWeeklySummaryWeekDto[]> {
    const totalWeeks =
      this.academicWeekService.calculateMaxAcademicWeek(period);
    const clubIds = clubs.map((club) => club.id);

    const [children, pagelas, exceptions] = await Promise.all([
      this.clubControlRepository.findSummaryChildrenByClubIds(clubIds),
      this.clubControlRepository.findSummaryPagelasByClubIds(
        clubIds,
        period.year,
      ),
      this.clubControlRepository.findActiveExceptions(),
    ]);

    const childrenByClub = groupChildrenByClub(children);
    const pagelasByClubWeek = groupPagelasByClubWeek(pagelas);
    const calendar: ClubWeekException[] = exceptions.map((exception) => ({
      exceptionDate: exception.exceptionDate,
      reason: exception.reason,
      isRecurrent: exception.isRecurrent,
    }));

    const weeks: ClubWeeklySummaryWeekDto[] = [];

    for (let week = 1; week <= totalWeeks; week += 1) {
      const timeline = weekTimelineOf(week, currentWeek);
      const cells = clubs.map((club) =>
        this.buildCell({
          club,
          week,
          timeline,
          period,
          calendar,
          children: childrenByClub.get(club.id) ?? [],
          pagelas: pagelasByClubWeek.get(clubWeekKey(club.id, week)),
        }),
      );

      weeks.push({
        week,
        startDate: this.academicWeekService.getExpectedDateForAcademicWeek(
          period.year,
          week,
          Weekday.MONDAY,
          period,
        ),
        endDate: this.academicWeekService.getExpectedDateForAcademicWeek(
          period.year,
          week,
          Weekday.SATURDAY,
          period,
        ),
        timeline,
        counts: sumCounts(cells.map((cell) => cell.counts)),
        statusCounts: countStatuses(cells),
        clubs: cells,
      });
    }

    return weeks;
  }

  /**
   * A situação de um clubinho numa semana.
   *
   * Clubinho desativado não recebe números: é o mesmo tratamento de
   * `ClubWeekCheckService`, onde as crianças dele passam a contar apenas como
   * "não frequentam mais" — cobrar pagela de um clubinho que não abre criaria
   * uma falta que ninguém pode resolver.
   */
  private buildCell({
    club,
    week,
    timeline,
    period,
    calendar,
    children,
    pagelas,
  }: {
    club: ClubSimpleResponseDto;
    week: number;
    timeline: ClubWeekTimeline;
    period: ClubPeriodEntity;
    calendar: ClubWeekException[];
    children: SummaryChildRaw[];
    pagelas?: Map<string, boolean>;
  }): ClubWeeklySummaryCellDto {
    const expectedDate =
      this.academicWeekService.getExpectedDateForAcademicWeek(
        period.year,
        week,
        club.weekday,
        period,
      );

    if (!club.isActive) {
      return {
        clubId: club.id,
        clubNumber: club.number,
        status: ClubWeekStatus.Inactive,
        expectedDate,
        exceptionReason: null,
        counts: emptyCounts(),
      };
    }

    const counted = children.filter((child) =>
      isChildCountedOn(child, expectedDate),
    );
    const withPagela = counted.filter((child) => pagelas?.has(child.childId));
    const present = withPagela.filter(
      (child) => pagelas?.get(child.childId) === true,
    );
    const counts = countsOf(counted.length, withPagela.length, present.length);

    if (
      !this.academicWeekService.isExpectedDateWithinPeriod(expectedDate, period)
    ) {
      return {
        clubId: club.id,
        clubNumber: club.number,
        status: ClubWeekStatus.OutOfPeriod,
        expectedDate,
        exceptionReason: null,
        counts,
      };
    }

    const exception = findExceptionForDate(calendar, expectedDate);
    const isCurrent = timeline === ClubWeekTimeline.Current;
    const isFuture = timeline === ClubWeekTimeline.Future;

    const status = toClubWeekStatus(
      this.clubStatusService.determineStatus(
        !!exception,
        isFuture,
        this.academicWeekService.hasPassedClubDay(
          expectedDate,
          isCurrent,
          isFuture,
        ),
        isCurrent,
        withPagela.length,
        counted.length,
      ),
    );

    return {
      clubId: club.id,
      clubNumber: club.number,
      status,
      expectedDate,
      exceptionReason: exception?.reason ?? null,
      counts,
    };
  }
}

/** O clubinho no contrato do resumo. */
function toSummaryClub(club: ClubSimpleResponseDto): ClubWeeklySummaryClubDto {
  return {
    clubId: club.id,
    clubNumber: club.number,
    weekday: club.weekday,
    isActive: club.isActive,
  };
}

/** Chave de uma célula do quadro. */
function clubWeekKey(clubId: string, week: number): string {
  return `${clubId}:${week}`;
}

/** As crianças de cada clubinho, indexadas uma vez só. */
function groupChildrenByClub(
  children: readonly SummaryChildRaw[],
): Map<string, SummaryChildRaw[]> {
  const grouped = new Map<string, SummaryChildRaw[]>();

  for (const child of children) {
    const list = grouped.get(child.clubId);
    if (list) list.push(child);
    else grouped.set(child.clubId, [child]);
  }

  return grouped;
}

/**
 * As pagelas de cada célula: por criança, se ela esteve presente.
 *
 * A chave é o par clubinho/semana porque é assim que o quadro pergunta. Uma
 * criança tem no máximo uma pagela por semana — a unicidade é do banco.
 */
function groupPagelasByClubWeek(
  pagelas: readonly SummaryPagelaRaw[],
): Map<string, Map<string, boolean>> {
  const grouped = new Map<string, Map<string, boolean>>();

  for (const pagela of pagelas) {
    const key = clubWeekKey(pagela.clubId, pagela.week);
    const cell = grouped.get(key) ?? new Map<string, boolean>();
    cell.set(pagela.childId, pagela.present);
    grouped.set(key, cell);
  }

  return grouped;
}
