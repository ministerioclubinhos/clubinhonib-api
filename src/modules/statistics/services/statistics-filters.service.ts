import { Injectable } from '@nestjs/common';
import { ObjectLiteral, SelectQueryBuilder } from 'typeorm';
import {
  formatDateOnly,
  parseDateOnly,
} from 'src/shared/academic-week/academic-week.util';
import { todayInAppTimezone } from 'src/shared/calendar-day/calendar-day.util';
import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { PagelasStatsQueryDto } from '../dto/pagelas-stats-query.dto';
import { AcceptedChristsStatsQueryDto } from '../dto/accepted-christs-stats-query.dto';
import { ENROLLED_AT_DECISION_DATE_SQL } from '../constants';
import { ChildScopeFilters } from '../types';

@Injectable()
export class StatisticsFiltersService {
  private getExclusiveEnd(date: string): string {
    const parsed = new Date(`${date}T00:00:00Z`);
    parsed.setUTCDate(parsed.getUTCDate() + 1);
    return parsed.toISOString().split('T')[0];
  }

  applyPagelasFilters(
    query: SelectQueryBuilder<PagelaEntity>,
    filters: PagelasStatsQueryDto,
  ): void {
    if (filters.year) {
      query.andWhere('pagela.year = :year', { year: filters.year });
    }
    if (filters.week) {
      query.andWhere('pagela.week = :week', { week: filters.week });
    }
    if (filters.startDate) {
      query.andWhere('pagela.referenceDate >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      query.andWhere('pagela.referenceDate < :endDateExclusive', {
        endDateExclusive: this.getExclusiveEnd(filters.endDate),
      });
    }

    this.applyChildScopeFilters(query, filters);

    if (filters.teacherId) {
      query.andWhere('pagela.teacher.id = :teacherId', {
        teacherId: filters.teacherId,
      });
    }

    if (filters.onlyPresent) {
      query.andWhere('pagela.present = :present', { present: true });
    }
    if (filters.onlyDidMeditation) {
      query.andWhere('pagela.didMeditation = :didMeditation', {
        didMeditation: true,
      });
    }
    if (filters.onlyRecitedVerse) {
      query.andWhere('pagela.recitedVerse = :recitedVerse', {
        recitedVerse: true,
      });
    }
  }

  /**
   * Recorta **quais crianças** entram na conta.
   *
   * É a parte dos filtros que não depende da pagela: clubinho, coordenador,
   * gênero, idade, endereço e data de entrada. Mora num método só porque a
   * conta de presenças esperadas precisa do mesmo recorte — se o numerador
   * filtrasse por cidade e o denominador não, a taxa não significaria nada.
   *
   * Espera os apelidos `child`, `club` e, havendo filtro de endereço,
   * `address`.
   */
  applyChildScopeFilters<T extends ObjectLiteral>(
    query: SelectQueryBuilder<T>,
    filters: ChildScopeFilters,
  ): void {
    if (filters.clubId) {
      query.andWhere('child.club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.clubIds && filters.clubIds.length > 0) {
      query.andWhere('child.club.id IN (:...scopeClubIds)', {
        scopeClubIds: filters.clubIds,
      });
    }
    if (filters.coordinatorId) {
      query.andWhere('club.coordinator.id = :coordinatorId', {
        coordinatorId: filters.coordinatorId,
      });
    }

    if (filters.gender) {
      query.andWhere('child.gender = :gender', { gender: filters.gender });
    }
    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const today = parseDateOnly(todayInAppTimezone());
      if (filters.maxAge !== undefined) {
        const minBirthDate = new Date(
          today.getFullYear() - filters.maxAge - 1,
          today.getMonth(),
          today.getDate(),
          12,
        );
        query.andWhere('child.birthDate >= :minBirthDate', {
          minBirthDate: formatDateOnly(minBirthDate),
        });
      }
      if (filters.minAge !== undefined) {
        const maxBirthDate = new Date(
          today.getFullYear() - filters.minAge,
          today.getMonth(),
          today.getDate(),
          12,
        );
        query.andWhere('child.birthDate <= :maxBirthDate', {
          maxBirthDate: formatDateOnly(maxBirthDate),
        });
      }
    }

    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }
    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }
    if (filters.district) {
      query.andWhere('address.district = :district', {
        district: filters.district,
      });
    }

    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', {
        joinedAfter: filters.joinedAfter,
      });
    }
    if (filters.joinedBefore) {
      query.andWhere('child.joinedAt < :joinedBeforeExclusive', {
        joinedBeforeExclusive: this.getExclusiveEnd(filters.joinedBefore),
      });
    }
  }

  /**
   * Escopo-base de toda contagem de decisões.
   *
   * O panorama, a aba de decisões e a de clubinhos contavam universos
   * diferentes — um exigia clubinho e criança ativos, outro não filtrava nada
   * —, e o mesmo "decisões no ano" saía com três valores. Agora é um só:
   * clubinho ativo e criança matriculada no dia da decisão.
   *
   * Decisão sem tipo (`decision` nulo, registro legado) fica **fora** dos
   * totais: o total é sempre aceitou + reconciliou. Quem precisa enxergá-las
   * pede `includeUnspecified`.
   */
  applyDecisionBaseScope(
    query: SelectQueryBuilder<AcceptedChristEntity>,
    options: { includeUnspecified?: boolean } = {},
  ): void {
    query
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_DECISION_DATE_SQL);

    if (!options.includeUnspecified) {
      query.andWhere('ac.decision IS NOT NULL');
    }
  }

  applyAcceptedChristsFilters(
    query: SelectQueryBuilder<AcceptedChristEntity>,
    filters: AcceptedChristsStatsQueryDto,
  ): void {
    if (filters.startDate) {
      query.andWhere('ac.createdAt >= :startDate', {
        startDate: filters.startDate,
      });
    }
    if (filters.endDate) {
      query.andWhere('ac.createdAt < :endDateExclusive', {
        endDateExclusive: this.getExclusiveEnd(filters.endDate),
      });
    }

    if (filters.clubId) {
      query.andWhere('child.club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.coordinatorId) {
      query.andWhere('club.coordinator.id = :coordinatorId', {
        coordinatorId: filters.coordinatorId,
      });
    }

    if (filters.decision) {
      query.andWhere('ac.decision = :decision', { decision: filters.decision });
    }

    if (filters.gender) {
      query.andWhere('child.gender = :gender', { gender: filters.gender });
    }
    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const today = new Date();
      if (filters.maxAge !== undefined) {
        const minBirthDate = new Date(
          today.getFullYear() - filters.maxAge - 1,
          today.getMonth(),
          today.getDate(),
        );
        query.andWhere('child.birthDate >= :minBirthDate', {
          minBirthDate: minBirthDate.toISOString().split('T')[0],
        });
      }
      if (filters.minAge !== undefined) {
        const maxBirthDate = new Date(
          today.getFullYear() - filters.minAge,
          today.getMonth(),
          today.getDate(),
        );
        query.andWhere('child.birthDate <= :maxBirthDate', {
          maxBirthDate: maxBirthDate.toISOString().split('T')[0],
        });
      }
    }

    if (filters.city) {
      query.andWhere('address.city = :city', { city: filters.city });
    }
    if (filters.state) {
      query.andWhere('address.state = :state', { state: filters.state });
    }
    if (filters.district) {
      query.andWhere('address.district = :district', {
        district: filters.district,
      });
    }

    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', {
        joinedAfter: filters.joinedAfter,
      });
    }
    if (filters.joinedBefore) {
      query.andWhere('child.joinedAt < :joinedBeforeExclusive', {
        joinedBeforeExclusive: this.getExclusiveEnd(filters.joinedBefore),
      });
    }
  }

  getDateGroupFormat(groupBy: 'day' | 'week' | 'month' | 'year'): {
    format: string;
    groupBy: string;
  } {
    switch (groupBy) {
      case 'day':
        // `DATE()` devolve uma coluna de data, e o driver a entrega como
        // objeto `Date` — que chegava no rótulo do eixo como
        // "Mon Mar 02 2026 00:00:00 GMT-0400 (Amazon Standard Time)". As
        // outras granularidades já vinham como texto; esta agora também.
        return {
          format: "DATE_FORMAT(pagela.referenceDate, '%Y-%m-%d')",
          groupBy: "DATE_FORMAT(pagela.referenceDate, '%Y-%m-%d')",
        };
      case 'week':
        return {
          format: "CONCAT(pagela.year, '-W', LPAD(pagela.week, 2, '0'))",
          groupBy: 'pagela.year, pagela.week',
        };
      case 'year':
        return {
          format: 'pagela.year',
          groupBy: 'pagela.year',
        };
      case 'month':
      default:
        return {
          format: "DATE_FORMAT(pagela.referenceDate, '%Y-%m')",
          groupBy: "DATE_FORMAT(pagela.referenceDate, '%Y-%m')",
        };
    }
  }
}
