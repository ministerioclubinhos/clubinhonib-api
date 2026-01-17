import { Injectable } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { PagelasStatsQueryDto } from '../dto/pagelas-stats-query.dto';
import { AcceptedChristsStatsQueryDto } from '../dto/accepted-christs-stats-query.dto';
import { getAcademicWeekYear } from '../../pagelas/week.util';

@Injectable()
export class StatisticsFiltersService {
  applyPagelasFilters(
    query: SelectQueryBuilder<PagelaEntity>,
    filters: PagelasStatsQueryDto,
  ): void {
    
    if (filters.startDate && filters.endDate && filters.groupBy === 'week') {
      
      try {
        const periodStartDate = '2025-01-01'; 
        const periodEndDate = '2025-12-31';
        const periodYear = 2025;

        const startWeek = getAcademicWeekYear(filters.startDate, periodStartDate, periodEndDate, periodYear);
        const endWeek = getAcademicWeekYear(filters.endDate, periodStartDate, periodEndDate, periodYear);

        
        if (startWeek.year === endWeek.year) {
          query.andWhere('pagela.year = :year', { year: startWeek.year });
          query.andWhere('pagela.week BETWEEN :startWeek AND :endWeek', {
            startWeek: startWeek.week,
            endWeek: endWeek.week
          });
        } else {
          
          query.andWhere(
            '(pagela.year = :startYear AND pagela.week >= :startWeek) OR (pagela.year = :endYear AND pagela.week <= :endWeek)',
            {
              startYear: startWeek.year,
              startWeek: startWeek.week,
              endYear: endWeek.year,
              endWeek: endWeek.week
            }
          );
        }
      } catch (error) {
        
        query.andWhere('pagela.referenceDate >= :startDate', { startDate: filters.startDate });
        query.andWhere('pagela.referenceDate <= :endDate', { endDate: filters.endDate });
      }
    } else {
      
      if (filters.year) {
        query.andWhere('pagela.year = :year', { year: filters.year });
      }
      if (filters.week) {
        query.andWhere('pagela.week = :week', { week: filters.week });
      }
      if (filters.startDate) {
        query.andWhere('pagela.referenceDate >= :startDate', { startDate: filters.startDate });
      }
      if (filters.endDate) {
        query.andWhere('pagela.referenceDate <= :endDate', { endDate: filters.endDate });
      }
    }

    if (filters.clubId) {
      query.andWhere('child.club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.teacherId) {
      query.andWhere('pagela.teacher.id = :teacherId', { teacherId: filters.teacherId });
    }
    if (filters.coordinatorId) {
      query.andWhere('club.coordinator.id = :coordinatorId', { coordinatorId: filters.coordinatorId });
    }

    if (filters.gender) {
      query.andWhere('child.gender = :gender', { gender: filters.gender });
    }
    if (filters.minAge !== undefined || filters.maxAge !== undefined) {
      const today = new Date();
      if (filters.maxAge !== undefined) {
        const minBirthDate = new Date(today.getFullYear() - filters.maxAge - 1, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate >= :minBirthDate', { 
          minBirthDate: minBirthDate.toISOString().split('T')[0] 
        });
      }
      if (filters.minAge !== undefined) {
        const maxBirthDate = new Date(today.getFullYear() - filters.minAge, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate <= :maxBirthDate', { 
          maxBirthDate: maxBirthDate.toISOString().split('T')[0] 
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
      query.andWhere('address.district = :district', { district: filters.district });
    }

    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', { joinedAfter: filters.joinedAfter });
    }
    if (filters.joinedBefore) {
      query.andWhere('child.joinedAt <= :joinedBefore', { joinedBefore: filters.joinedBefore });
    }

    if (filters.onlyPresent) {
      query.andWhere('pagela.present = :present', { present: true });
    }
    if (filters.onlyDidMeditation) {
      query.andWhere('pagela.didMeditation = :didMeditation', { didMeditation: true });
    }
    if (filters.onlyRecitedVerse) {
      query.andWhere('pagela.recitedVerse = :recitedVerse', { recitedVerse: true });
    }
  }

  applyAcceptedChristsFilters(
    query: SelectQueryBuilder<AcceptedChristEntity>,
    filters: AcceptedChristsStatsQueryDto,
  ): void {
    if (filters.startDate) {
      query.andWhere('ac.createdAt >= :startDate', { startDate: filters.startDate });
    }
    if (filters.endDate) {
      query.andWhere('ac.createdAt <= :endDate', { endDate: filters.endDate });
    }

    if (filters.clubId) {
      query.andWhere('child.club.id = :clubId', { clubId: filters.clubId });
    }
    if (filters.coordinatorId) {
      query.andWhere('club.coordinator.id = :coordinatorId', { coordinatorId: filters.coordinatorId });
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
        const minBirthDate = new Date(today.getFullYear() - filters.maxAge - 1, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate >= :minBirthDate', { 
          minBirthDate: minBirthDate.toISOString().split('T')[0] 
        });
      }
      if (filters.minAge !== undefined) {
        const maxBirthDate = new Date(today.getFullYear() - filters.minAge, today.getMonth(), today.getDate());
        query.andWhere('child.birthDate <= :maxBirthDate', { 
          maxBirthDate: maxBirthDate.toISOString().split('T')[0] 
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
      query.andWhere('address.district = :district', { district: filters.district });
    }

    if (filters.joinedAfter) {
      query.andWhere('child.joinedAt >= :joinedAfter', { joinedAfter: filters.joinedAfter });
    }
    if (filters.joinedBefore) {
      query.andWhere('child.joinedAt <= :joinedBefore', { joinedBefore: filters.joinedBefore });
    }
  }

  getDateGroupFormat(groupBy: 'day' | 'week' | 'month' | 'year'): { format: string; groupBy: string } {
    switch (groupBy) {
      case 'day':
        return {
          format: 'DATE(pagela.referenceDate)',
          groupBy: 'DATE(pagela.referenceDate)',
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

