import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { ChildEntity } from '../../children/entities/child.entity';
import { ClubEntity } from '../../clubs/entities/club.entity';
import { TeacherProfileEntity } from '../../teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import {
  ENROLLED_AT_PAGELA_DATE_SQL,
  ENROLLED_AT_PARAM_DATE_SQL,
  LOW_ATTENDANCE_THRESHOLD,
  LOW_ENGAGEMENT_THRESHOLD,
} from '../constants';
import {
  averageOf,
  engagementScore,
  presenceRate,
  toCount,
} from '../utils/metrics.utils';
import { ExpectedChildrenRepository } from './expected-children.repository';

/**
 * Totais e distribuições da visão geral.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas. São as consultas que alimentam `/statistics/overview`: só
 * contagens e agregações, sem os filtros das listagens.
 */
@Injectable()
export class OverviewStatisticsRepository {
  constructor(
    @InjectRepository(PagelaEntity)
    private readonly pagelasRepository: Repository<PagelaEntity>,
    @InjectRepository(ChildEntity)
    private readonly childrenRepository: Repository<ChildEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubsRepository: Repository<ClubEntity>,
    @InjectRepository(TeacherProfileEntity)
    private readonly teachersRepository: Repository<TeacherProfileEntity>,
    private readonly expectedChildrenRepository: ExpectedChildrenRepository,
  ) {}

  /**
   * Os totais de **hoje**.
   *
   * "Crianças" é uma definição só, usada aqui, na divisão por gênero e na aba
   * de crianças: criança ativa em clubinho ativo. Antes este total contava
   * também quem estava sem clubinho ou em clubinho desativado, e os três
   * números da mesma tela não fechavam entre si.
   */
  async getTotalCounts() {
    const [
      totalChildren,
      totalClubs,
      totalTeachers,
      inactiveChildren,
      inactiveClubs,
    ] = await Promise.all([
      this.childrenRepository
        .createQueryBuilder('child')
        .innerJoin('child.club', 'club')
        .where('club.isActive = :clubActive', { clubActive: true })
        .andWhere('child.isActive = :isActive', { isActive: true })
        .getCount(),
      this.clubsRepository.count({ where: { isActive: true } }),
      this.teachersRepository.count(),
      this.childrenRepository.count({ where: { isActive: false } }),
      this.clubsRepository.count({ where: { isActive: false } }),
    ]);

    return {
      totalChildren,
      totalClubs,
      totalTeachers,
      inactiveChildren,
      inactiveClubs,
    };
  }

  /**
   * Quem esteve em atividade no recorte.
   *
   * Criança ativa é a que teve **presença** registrada; professor ativo é o
   * que lançou pagela. A data é a da pagela (`referenceDate`), e não a do
   * lançamento: lançar hoje as pagelas atrasadas de março fazia o clubinho
   * inteiro aparecer como "ativo neste mês".
   */
  async getActiveCounts(startDate: string, endDate: string) {
    const inWindow = () =>
      this.pagelasRepository
        .createQueryBuilder('pagela')
        .leftJoin('pagela.child', 'child')
        .leftJoin('child.club', 'club')
        .where('club.isActive = :clubActive', { clubActive: true })
        .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
        .andWhere('pagela.referenceDate >= :startDate', { startDate })
        .andWhere('pagela.referenceDate <= :endDate', { endDate });

    const [children, teachers] = await Promise.all([
      inWindow()
        .andWhere('pagela.present = :present', { present: true })
        .select('COUNT(DISTINCT child.id)', 'count')
        .getRawOne<{ count: string }>(),
      inWindow()
        .select('COUNT(DISTINCT pagela.teacher.id)', 'count')
        .getRawOne<{ count: string }>(),
    ]);

    return {
      activeChildren: toCount(children?.count),
      activeTeachers: toCount(teachers?.count),
    };
  }

  /**
   * Quantos clubinhos ficaram abaixo da presença mínima no recorte.
   *
   * A taxa é presentes ÷ esperados. Clubinho que tinha criança esperada e não
   * lançou pagela nenhuma entra com 0% — antes ele nem aparecia na consulta, e
   * o indicador deixava de fora justamente o pior caso.
   */
  async countClubsWithLowAttendance(
    startDate: string,
    endDate: string,
  ): Promise<number> {
    const [presentByClub, expectedByClub] = await Promise.all([
      this.pagelasRepository
        .createQueryBuilder('pagela')
        .leftJoin('pagela.child', 'child')
        .leftJoin('child.club', 'club')
        .where('club.isActive = :clubActive', { clubActive: true })
        .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
        .andWhere('pagela.referenceDate >= :startDate', { startDate })
        .andWhere('pagela.referenceDate <= :endDate', { endDate })
        .select('club.id', 'clubId')
        .addSelect(
          'SUM(CASE WHEN pagela.present = 1 THEN 1 ELSE 0 END)',
          'presentCount',
        )
        .groupBy('club.id')
        .getRawMany<{ clubId: string; presentCount: string }>(),
      this.expectedChildrenRepository.summarize(
        { startDate, endDate },
        (child) => child.clubId,
      ),
    ]);

    const present = new Map(
      presentByClub.map((row) => [row.clubId, toCount(row.presentCount)]),
    );

    let clubsWithLowAttendance = 0;
    expectedByClub.forEach((expected, clubId) => {
      const rate = presenceRate(present.get(clubId) ?? 0, expected.slots);
      if (rate < LOW_ATTENDANCE_THRESHOLD) clubsWithLowAttendance++;
    });

    return clubsWithLowAttendance;
  }

  async getChildrenEngagementMetrics(startDate: string, endDate: string) {
    const childrenStats = await this.pagelasRepository
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PAGELA_DATE_SQL)
      .andWhere('pagela.referenceDate >= :startDate', { startDate })
      .andWhere('pagela.referenceDate <= :endDate', { endDate })
      .select('child.id', 'childId')
      .addSelect('COUNT(pagela.id)', 'totalPagelas')
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
      .groupBy('child.id')
      .getRawMany<{
        childId: string;
        totalPagelas: string;
        presentCount: string;
        meditationCount: string;
        verseCount: string;
      }>();

    // Só entra quem tem pagela no recorte (é o que a consulta devolve): quem
    // não tem não puxa a média para zero.
    const scores = childrenStats.map((child) =>
      engagementScore({
        presenceCount: toCount(child.presentCount),
        meditationCount: toCount(child.meditationCount),
        verseCount: toCount(child.verseCount),
        totalPagelas: toCount(child.totalPagelas),
      }),
    );

    return {
      avgEngagementScore: averageOf(scores, (score) => score),
      childrenWithLowEngagement: scores.filter(
        (score) => score < LOW_ENGAGEMENT_THRESHOLD,
      ).length,
    };
  }

  async getChildrenGenderDistribution() {
    const result = await this.childrenRepository
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere('child.isActive = :isActive', { isActive: true })
      .select('child.gender', 'gender')
      .addSelect('COUNT(child.id)', 'count')
      .groupBy('child.gender')
      .getRawMany<{ gender: string; count: string }>();

    const distribution = { M: 0, F: 0 };
    result.forEach((row) => {
      if (row.gender === 'M') distribution.M = parseInt(row.count);
      if (row.gender === 'F') distribution.F = parseInt(row.count);
    });

    return distribution;
  }

  async getGeographicDistribution() {
    const byState = await this.clubsRepository
      .createQueryBuilder('club')
      .leftJoin('club.address', 'address')
      .where('club.isActive = :isActive', { isActive: true })
      .select('address.state', 'state')
      .addSelect('COUNT(club.id)', 'count')
      .groupBy('address.state')
      .orderBy('count', 'DESC')
      .getRawMany<{ state: string; count: string }>();

    const topCities = await this.clubsRepository
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.address', 'address')
      .leftJoin('club.children', 'child')
      .where('club.isActive = :isActive', { isActive: true })
      .andWhere('child.isActive = :childActive', { childActive: true })
      .select('address.city', 'city')
      .addSelect('address.state', 'state')
      .addSelect('COUNT(DISTINCT club.id)', 'totalClubs')
      .addSelect('COUNT(DISTINCT child.id)', 'totalChildren')
      .groupBy('address.city')
      .addGroupBy('address.state')
      .orderBy('totalChildren', 'DESC')
      .getRawMany<{
        city: string;
        state: string;
        totalClubs: string;
        totalChildren: string;
      }>();

    return {
      byState: byState.map((row) => ({
        state: row.state,
        count: parseInt(row.count),
      })),
      topCities: topCities.map((row) => ({
        city: row.city,
        state: row.state,
        totalChildren: parseInt(row.totalChildren),
        totalClubs: parseInt(row.totalClubs),
      })),
    };
  }

  /**
   * Quantas crianças estavam matriculadas na data, em clubinho ativo.
   *
   * É a base do crescimento: as duas pontas da comparação — hoje e três meses
   * atrás — passam por aqui, com a mesma regra. Antes o "hoje" contava toda
   * criança ativa e o "antes" só as de clubinho ativo, e a diferença de
   * critério aparecia como crescimento.
   */
  async getChildrenCountAt(date: string): Promise<number> {
    return this.childrenRepository
      .createQueryBuilder('child')
      .innerJoin('child.club', 'club')
      .where('club.isActive = :clubActive', { clubActive: true })
      .andWhere(ENROLLED_AT_PARAM_DATE_SQL, { enrolledAt: date })
      .getCount();
  }
}
