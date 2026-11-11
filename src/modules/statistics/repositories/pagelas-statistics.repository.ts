import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { StatisticsFiltersService } from '../services/statistics-filters.service';
import { PagelasStatsQueryDto } from '../dto/pagelas-stats-query.dto';
import {
  PagelasByCityRaw,
  PagelasByClubRaw,
  PagelasByTeacherRaw,
  PagelasDemographicsRaw,
  PagelasOverallStatsRaw,
  PagelasTimeSeriesRaw,
  PagelasTopPerformerRaw,
  PagelasWeeklyStatsRaw,
  ParticipationTimeStats,
} from '../dto/statistics-raw-results.dto';
import {
  ageGroup as toAgeGroup,
  ageInYears,
  monthsParticipating as countMonthsParticipating,
  participationTimeRange as toParticipationTimeRange,
  presenceRateOrPerPagela,
} from '../utils/metrics.utils';
import { ENROLLED_AT_PAGELA_DATE_SQL } from '../constants';
import { ExpectedChildRow, ExpectedSummary, ExpectedWeek } from '../types';
import { ExpectedChildrenRepository } from './expected-children.repository';

/**
 * Consultas de pagelas.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas. O bloco alcança uma tabela e o serviço de filtros, e nada
 * mais — por isso sai inteiro.
 */
/**
 * A faixa etária calculada no banco, com os mesmos cortes de `ageGroup()`.
 *
 * Repetida no `SELECT` e no `GROUP BY` porque o MySQL não aceita apelido de
 * coluna no agrupamento — daí a constante, para as duas não divergirem.
 */
const AGE_GROUP_SQL = `CASE
  WHEN TIMESTAMPDIFF(YEAR, child.birthDate, CURDATE()) <= 5 THEN '0-5'
  WHEN TIMESTAMPDIFF(YEAR, child.birthDate, CURDATE()) <= 10 THEN '6-10'
  WHEN TIMESTAMPDIFF(YEAR, child.birthDate, CURDATE()) <= 15 THEN '11-15'
  ELSE '16+'
END`;

/** Cidade e estado numa chave só: há cidades homônimas em estados diferentes. */
const cityKey = (city: string, state: string | null): string =>
  `${city}|${state ?? ''}`;

/** Chave única do agrupamento "tudo junto". */
const OVERALL_KEY = 'all';

/** Uma linha do agrupamento por faixa etária, como o driver a devolve. */
interface AgeGroupRaw {
  ageGroup: string;
  total: string;
  presentCount: string | null;
  meditationCount: string | null;
  verseCount: string | null;
}

@Injectable()
export class PagelasStatisticsRepository {
  constructor(
    @InjectRepository(PagelaEntity)
    private readonly pagelasRepository: Repository<PagelaEntity>,
    private readonly filtersService: StatisticsFiltersService,
    private readonly expectedChildrenRepository: ExpectedChildrenRepository,
  ) {}

  /** Presenças esperadas no recorte, por grupo — o denominador da presença. */
  private expectedBy(
    filters: PagelasStatsQueryDto,
    keyOf: (child: ExpectedChildRow, week: ExpectedWeek) => string | null,
  ): Promise<Map<string, ExpectedSummary> | null> {
    return this.expectedChildrenRepository.summarizeForPagelas(filters, keyOf);
  }

  /**
   * O denominador que a resposta expõe ao lado da taxa.
   *
   * Havendo conta de esperados, é ela — inclusive quando dá zero. Só no
   * recorte por professor, em que a conta não existe, vale o total de pagelas.
   */
  private expectedPresencesOf(
    totalPagelas: number,
    expected: Map<string, ExpectedSummary> | null,
    key: string,
  ): number {
    return expected ? (expected.get(key)?.slots ?? 0) : totalPagelas;
  }

  /** Presentes ÷ esperados; sem conta de esperados, presentes ÷ pagelas. */
  private presenceRateOf(
    present: number,
    totalPagelas: number,
    expected: Map<string, ExpectedSummary> | null,
    key: string,
  ): number {
    return presenceRateOrPerPagela(
      present,
      totalPagelas,
      expected ? (expected.get(key)?.slots ?? 0) : null,
    );
  }

  async getPagelasWeeklyStats(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .leftJoin('pagela.teacher', 'teacher')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .select('pagela.year', 'year')
      .addSelect('pagela.week', 'week')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presentCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'didMeditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'recitedVerseCount',
      )
      .addSelect('COUNT(DISTINCT pagela.child.id)', 'uniqueChildren')
      .addSelect('COUNT(DISTINCT pagela.teacher.id)', 'uniqueTeachers')
      .groupBy('pagela.year')
      .addGroupBy('pagela.week')
      .orderBy('pagela.year', 'DESC')
      .addOrderBy('pagela.week', 'DESC');

    this.filtersService.applyPagelasFilters(query, filters);

    const [results, expected] = await Promise.all([
      query.getRawMany<PagelasWeeklyStatsRaw>(),
      this.expectedBy(filters, (_child, week) => `${week.year}-${week.week}`),
    ]);

    return results.map((row) => {
      const weekKey = `${parseInt(row.year)}-${parseInt(row.week)}`;
      const totalPagelas = parseInt(row.totalPagelas);
      const presentCount = parseInt(row.presentCount);
      const didMeditationCount = parseInt(row.didMeditationCount);
      const recitedVerseCount = parseInt(row.recitedVerseCount);

      return {
        year: parseInt(row.year),
        week: parseInt(row.week),
        totalPagelas,
        presentCount,
        didMeditationCount,
        recitedVerseCount,
        uniqueChildren: parseInt(row.uniqueChildren),
        uniqueTeachers: parseInt(row.uniqueTeachers),
        expectedPresences: this.expectedPresencesOf(
          totalPagelas,
          expected,
          weekKey,
        ),
        presenceRate: this.presenceRateOf(
          presentCount,
          totalPagelas,
          expected,
          weekKey,
        ),
        meditationRate:
          totalPagelas > 0 ? (didMeditationCount / totalPagelas) * 100 : 0,
        verseRecitationRate:
          totalPagelas > 0 ? (recitedVerseCount / totalPagelas) * 100 : 0,
      };
    });
  }

  async getPagelasOverallStats(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .leftJoin('pagela.teacher', 'teacher')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .select('COUNT(pagela.id)', 'totalPagelas')
      .addSelect('COUNT(DISTINCT pagela.child.id)', 'totalChildren')
      .addSelect('COUNT(DISTINCT pagela.teacher.id)', 'totalTeachers')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presentCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'didMeditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'recitedVerseCount',
      );

    this.filtersService.applyPagelasFilters(query, filters);

    const [result, expected] = await Promise.all([
      query.getRawOne<PagelasOverallStatsRaw>(),
      this.expectedBy(filters, () => OVERALL_KEY),
    ]);

    const totalPagelas = parseInt(result?.totalPagelas || '0');

    return {
      totalPagelas,
      totalChildren: parseInt(result?.totalChildren || '0'),
      totalTeachers: parseInt(result?.totalTeachers || '0'),
      expectedPresences: this.expectedPresencesOf(
        totalPagelas,
        expected,
        OVERALL_KEY,
      ),
      averagePresenceRate: this.presenceRateOf(
        parseInt(result?.presentCount || '0'),
        totalPagelas,
        expected,
        OVERALL_KEY,
      ),
      averageMeditationRate:
        totalPagelas > 0
          ? (parseInt(result?.didMeditationCount || '0') / totalPagelas) * 100
          : 0,
      averageVerseRecitationRate:
        totalPagelas > 0
          ? (parseInt(result?.recitedVerseCount || '0') / totalPagelas) * 100
          : 0,
    };
  }

  async getPagelasTopPerformers(
    filters: PagelasStatsQueryDto,
    limit: number = 10,
  ) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .select('child.id', 'childId')
      .addSelect('child.name', 'childName')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presenceCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'verseRecitationCount',
      )
      .groupBy('child.id')
      .addGroupBy('child.name')
      .orderBy('presenceCount', 'DESC')
      .addOrderBy('meditationCount', 'DESC')
      .limit(limit);

    this.filtersService.applyPagelasFilters(query, filters);

    const results = await query.getRawMany<PagelasTopPerformerRaw>();

    return results.map((row) => ({
      childId: row.childId,
      childName: row.childName,
      presenceCount: parseInt(row.presenceCount),
      meditationCount: parseInt(row.meditationCount),
      verseRecitationCount: parseInt(row.verseRecitationCount),
    }));
  }

  async getPagelasByGender(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .select('child.gender', 'gender')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presentCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'verseCount',
      )
      .groupBy('child.gender');

    this.filtersService.applyPagelasFilters(query, filters);

    const [results, expected] = await Promise.all([
      query.getRawMany<PagelasDemographicsRaw>(),
      this.expectedBy(filters, (child) => child.gender),
    ]);

    return results.map((row) => {
      const total = parseInt(row.total);
      return {
        gender: row.gender,
        total,
        presenceRate: this.presenceRateOf(
          parseInt(row.presentCount),
          total,
          expected,
          row.gender,
        ),
        meditationRate:
          total > 0 ? (parseInt(row.meditationCount) / total) * 100 : 0,
        verseRecitationRate:
          total > 0 ? (parseInt(row.verseCount) / total) * 100 : 0,
      };
    });
  }

  /**
   * Pagelas por faixa etária, agrupadas pelo banco.
   *
   * Antes esta consulta fazia `getMany()` com a criança carregada junto e
   * contava as faixas em JavaScript: sem filtro, isso trazia a tabela inteira
   * de pagelas para a memória do processo. A conta é a mesma de
   * `ageGroup()` — os cortes em 5, 10 e 15 anos —, feita agora onde os dados
   * estão. `TIMESTAMPDIFF` em anos já desconta o aniversário que ainda não
   * chegou, que é a mesma regra de `ageInYears`.
   */
  async getPagelasByAgeGroup(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL);

    this.filtersService.applyPagelasFilters(query, filters);

    const [rows, expected] = await Promise.all([
      query
        .select(AGE_GROUP_SQL, 'ageGroup')
        .addSelect('COUNT(pagela.id)', 'total')
        .addSelect('SUM(pagela.present)', 'presentCount')
        .addSelect('SUM(pagela.didMeditation)', 'meditationCount')
        .addSelect('SUM(pagela.recitedVerse)', 'verseCount')
        .groupBy(AGE_GROUP_SQL)
        .getRawMany<AgeGroupRaw>(),
      this.expectedBy(filters, (child) =>
        toAgeGroup(ageInYears(child.birthDate)),
      ),
    ]);

    return rows.map((row) => {
      const total = Number(row.total);
      // `SUM` de um grupo sem linhas devolve `NULL`; aqui isso é zero.
      const rate = (count: string | null) =>
        total > 0 ? (Number(count ?? 0) / total) * 100 : 0;

      return {
        ageGroup: row.ageGroup,
        total,
        presenceRate: this.presenceRateOf(
          Number(row.presentCount ?? 0),
          total,
          expected,
          row.ageGroup,
        ),
        meditationRate: rate(row.meditationCount),
        verseRecitationRate: rate(row.verseCount),
      };
    });
  }

  async getPagelasByClub(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.id IS NOT NULL')
      .andWhere('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .select('club.id', 'clubId')
      .addSelect('club.number', 'clubNumber')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presentCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'verseCount',
      )
      .groupBy('club.id')
      .addGroupBy('club.number')
      .orderBy('clubNumber', 'ASC');

    this.filtersService.applyPagelasFilters(query, filters);

    const [results, expected] = await Promise.all([
      query.getRawMany<PagelasByClubRaw>(),
      this.expectedBy(filters, (child) => child.clubId),
    ]);

    return results.map((row) => {
      const total = parseInt(row.total);
      return {
        clubId: row.clubId,
        clubNumber: parseInt(row.clubNumber),
        total,
        uniqueChildren: parseInt(row.uniqueChildren),
        presenceRate: this.presenceRateOf(
          parseInt(row.presentCount),
          total,
          expected,
          row.clubId,
        ),
        meditationRate:
          total > 0 ? (parseInt(row.meditationCount) / total) * 100 : 0,
        verseRecitationRate:
          total > 0 ? (parseInt(row.verseCount) / total) * 100 : 0,
      };
    });
  }

  async getPagelasByTeacher(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.teacher', 'teacher')
      .leftJoin('teacher.user', 'user')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('teacher.id IS NOT NULL')
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .select('teacher.id', 'teacherId')
      .addSelect('user.name', 'teacherName')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presentCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'verseCount',
      )
      .groupBy('teacher.id')
      .addGroupBy('user.name')
      .orderBy('total', 'DESC');

    this.filtersService.applyPagelasFilters(query, filters);

    const results = await query.getRawMany<PagelasByTeacherRaw>();

    return results.map((row) => {
      const total = parseInt(row.total);
      return {
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        total,
        uniqueChildren: parseInt(row.uniqueChildren),
        presenceRate:
          total > 0 ? (parseInt(row.presentCount) / total) * 100 : 0,
        meditationRate:
          total > 0 ? (parseInt(row.meditationCount) / total) * 100 : 0,
        verseRecitationRate:
          total > 0 ? (parseInt(row.verseCount) / total) * 100 : 0,
      };
    });
  }

  async getPagelasTimeSeries(filters: PagelasStatsQueryDto) {
    const groupBy = filters.groupBy || 'week';
    const dateFormat = this.filtersService.getDateGroupFormat(groupBy);

    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .select(`${dateFormat.format}`, 'period')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'present',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditation',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'verse',
      )
      .groupBy(dateFormat.groupBy)
      .orderBy('period', 'ASC');

    this.filtersService.applyPagelasFilters(query, filters);

    const results = await query.getRawMany<PagelasTimeSeriesRaw>();

    return results.map((row) => ({
      date: row.period,
      total: parseInt(row.total),
      present: parseInt(row.present),
      meditation: parseInt(row.meditation),
      verse: parseInt(row.verse),
    }));
  }

  async getPagelasByCity(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('address.city IS NOT NULL')
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .select('address.city', 'city')
      .addSelect('address.state', 'state')
      .addSelect('COUNT(pagela.id)', 'total')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(
        'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
        'presentCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.didMeditation = 1 THEN 1 ELSE 0 END)',
        'meditationCount',
      )
      .addSelect(
        'SUM(CASE WHEN pagela.recitedVerse = 1 THEN 1 ELSE 0 END)',
        'verseCount',
      )
      .groupBy('address.city')
      .addGroupBy('address.state')
      .orderBy('total', 'DESC');

    this.filtersService.applyPagelasFilters(query, filters);

    const [results, expected] = await Promise.all([
      query.getRawMany<PagelasByCityRaw>(),
      this.expectedBy(filters, (child) =>
        child.city ? cityKey(child.city, child.state) : null,
      ),
    ]);

    return results.map((row) => {
      const total = parseInt(row.total);
      return {
        city: row.city,
        state: row.state,
        total,
        uniqueChildren: parseInt(row.uniqueChildren),
        presenceRate: this.presenceRateOf(
          parseInt(row.presentCount),
          total,
          expected,
          cityKey(row.city, row.state),
        ),
        meditationRate:
          total > 0 ? (parseInt(row.meditationCount) / total) * 100 : 0,
        verseRecitationRate:
          total > 0 ? (parseInt(row.verseCount) / total) * 100 : 0,
      };
    });
  }

  async getPagelasByParticipationTime(filters: PagelasStatsQueryDto) {
    const query = this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoinAndSelect('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('child.address', 'address')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL);

    this.filtersService.applyPagelasFilters(query, filters);

    const [pagelas, expected] = await Promise.all([
      query.getMany(),
      this.expectedBy(filters, (child) =>
        toParticipationTimeRange(countMonthsParticipating(child.joinedAt)),
      ),
    ]);

    const timeGroups = new Map<string, ParticipationTimeStats>();

    pagelas.forEach((pagela) => {
      const months = countMonthsParticipating(pagela.child.joinedAt);
      const timeRange = toParticipationTimeRange(months);

      if (!timeGroups.has(timeRange)) {
        timeGroups.set(timeRange, {
          timeRange,
          total: 0,
          presentCount: 0,
          meditationCount: 0,
          verseCount: 0,
          childrenMonths: [],
        });
      }

      const group = timeGroups.get(timeRange)!;
      group.total++;
      if (pagela.present) group.presentCount++;
      if (pagela.didMeditation) group.meditationCount++;
      if (pagela.recitedVerse) group.verseCount++;
      group.childrenMonths.push(months);
    });

    const uniqueChildrenByRange = new Map<string, Set<string>>();
    pagelas.forEach((pagela) => {
      const months = countMonthsParticipating(pagela.child.joinedAt);
      const timeRange = toParticipationTimeRange(months);
      if (!uniqueChildrenByRange.has(timeRange)) {
        uniqueChildrenByRange.set(timeRange, new Set());
      }
      uniqueChildrenByRange.get(timeRange)!.add(pagela.child.id);
    });

    const orderedRanges = ['0-3 meses', '3-6 meses', '6-12 meses', '1+ ano'];

    return orderedRanges
      .filter((range) => timeGroups.has(range))
      .map((range) => {
        const group = timeGroups.get(range)!;
        const avgMonths =
          group.childrenMonths.length > 0
            ? group.childrenMonths.reduce((a: number, b: number) => a + b, 0) /
              group.childrenMonths.length
            : 0;

        return {
          timeRange: group.timeRange,
          total: group.total,
          uniqueChildren: uniqueChildrenByRange.get(range)?.size || 0,
          presenceRate: this.presenceRateOf(
            group.presentCount,
            group.total,
            expected,
            range,
          ),
          meditationRate:
            group.total > 0 ? (group.meditationCount / group.total) * 100 : 0,
          verseRecitationRate:
            group.total > 0 ? (group.verseCount / group.total) * 100 : 0,
          avgMonthsParticipating: Math.round(avgMonths * 10) / 10,
        };
      });
  }
}
