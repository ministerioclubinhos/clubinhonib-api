import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { PagelasStatsQueryDto } from '../dto/pagelas-stats-query.dto';
import { AcceptedChristsStatsQueryDto } from '../dto/accepted-christs-stats-query.dto';

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

    if (filters.clubId) {
      query.andWhere('child.club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.teacherId) {
      query.andWhere('pagela.teacher.id = :teacherId', {
        teacherId: filters.teacherId,
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
