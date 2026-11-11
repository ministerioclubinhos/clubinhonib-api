import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { DecisionType } from '../../accepted-christs/enums/decision-type.enum';
import { StatisticsFiltersService } from '../services/statistics-filters.service';
import { AcceptedChristsStatsQueryDto } from '../dto/accepted-christs-stats-query.dto';
import {
  AcceptedChristsByCityRaw,
  AcceptedChristsByClubRaw,
  AcceptedChristsByGenderRaw,
  AcceptedChristsByPeriodRaw,
  AcceptedChristsOverallStatsRaw,
  AcceptedChristsTimeSeriesRaw,
} from '../dto/statistics-raw-results.dto';
import {
  DISTINCT_ACCEPTED_CHILDREN_SQL,
  DISTINCT_RECONCILED_CHILDREN_SQL,
  PARTICIPATION_TIME_RANGES,
} from '../constants';
import { ClubDecisionCounts } from '../types';
import {
  ageGroup as toAgeGroup,
  ageInYears,
  monthsParticipating as countMonthsParticipating,
  participationTimeRange as toParticipationTimeRange,
  averageOf,
  toCount,
} from '../utils/metrics.utils';

/**
 * Consultas de decisões.
 *
 * Saiu de `statistics.repository.ts`, que reunia sete assuntos num arquivo só
 * de 3.400 linhas. O bloco alcança uma tabela e o serviço de filtros, e nada
 * mais — por isso sai inteiro.
 *
 * Três regras valem para todas as consultas daqui, e é por elas que os números
 * desta aba batem com os do panorama e os da aba de clubinhos:
 *
 * - **escopo**: clubinho ativo e criança matriculada no dia da decisão
 *   (`StatisticsFiltersService.applyDecisionBaseScope`);
 * - **tipo**: decisão sem tipo (registro legado, `decision` nulo) fica fora de
 *   todo total — `total` é sempre aceitou + reconciliou. Ela aparece à parte,
 *   em `unspecifiedDecisions` e na lista de decisões recentes;
 * - **contagem**: por criança distinta dentro de cada tipo, não por linha.
 */

/** Crianças distintas de cada tipo dentro de um grupo montado em memória. */
interface DecisionGroup {
  accepted: Set<string>;
  reconciled: Set<string>;
  /** Meses de participação de cada criança do grupo. */
  monthsByChild: Map<string, number>;
}

const emptyDecisionGroup = (): DecisionGroup => ({
  accepted: new Set(),
  reconciled: new Set(),
  monthsByChild: new Map(),
});

@Injectable()
export class AcceptedChristsStatisticsRepository {
  constructor(
    @InjectRepository(AcceptedChristEntity)
    private readonly acceptedChristsRepository: Repository<AcceptedChristEntity>,
    private readonly filtersService: StatisticsFiltersService,
  ) {}

  /** Consulta-base: os apelidos e o escopo que todas as contagens usam. */
  private baseQuery(
    filters: AcceptedChristsStatsQueryDto,
    options: { includeUnspecified?: boolean } = {},
  ): SelectQueryBuilder<AcceptedChristEntity> {
    const query = this.acceptedChristsRepository
      .createQueryBuilder('ac')
      .leftJoin('ac.child', 'child')
      .leftJoin('child.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      // Sem este join, um filtro de cidade, estado ou bairro derrubava a rota
      // com "unknown column address.city".
      .leftJoin('child.address', 'address');

    this.filtersService.applyDecisionBaseScope(query, options);
    this.filtersService.applyAcceptedChristsFilters(query, filters);

    return query;
  }

  /** Formato do rótulo de período em SQL, por granularidade. */
  private periodFormat(
    groupBy: AcceptedChristsStatsQueryDto['groupBy'],
  ): string {
    switch (groupBy) {
      case 'day':
        // Texto, e não coluna de data: o driver devolveria um `Date`, que
        // vira "Mon Mar 02 2026 …" no rótulo do gráfico.
        return "DATE_FORMAT(ac.createdAt, '%Y-%m-%d')";
      case 'week':
        return "CONCAT(YEAR(ac.createdAt), '-W', LPAD(WEEK(ac.createdAt, 3), 2, '0'))";
      case 'year':
        return 'YEAR(ac.createdAt)';
      case 'month':
      default:
        return "DATE_FORMAT(ac.createdAt, '%Y-%m')";
    }
  }

  async getAcceptedChristsOverallStats(filters: AcceptedChristsStatsQueryDto) {
    const [byType, unique, unspecified] = await Promise.all([
      this.baseQuery(filters)
        .select('ac.decision', 'decision')
        .addSelect('COUNT(DISTINCT child.id)', 'totalDecisions')
        .groupBy('ac.decision')
        .getRawMany<AcceptedChristsOverallStatsRaw>(),
      this.baseQuery(filters)
        .select('COUNT(DISTINCT child.id)', 'uniqueChildren')
        .getRawOne<{ uniqueChildren: string }>(),
      this.baseQuery(filters, { includeUnspecified: true })
        .andWhere('ac.decision IS NULL')
        .select('COUNT(ac.id)', 'total')
        .getRawOne<{ total: string }>(),
    ]);

    const byDecisionType: { [key: string]: number } = {};
    let totalDecisions = 0;

    byType.forEach((row) => {
      const count = toCount(row.totalDecisions);
      totalDecisions += count;
      byDecisionType[row.decision] = count;
    });

    return {
      totalDecisions,
      uniqueChildren: toCount(unique?.uniqueChildren),
      byDecisionType,
      unspecifiedDecisions: toCount(unspecified?.total),
    };
  }

  async getAcceptedChristsByPeriod(filters: AcceptedChristsStatsQueryDto) {
    const format = this.periodFormat(filters.groupBy || 'month');

    // `uniqueChildren` tem consulta própria. Antes vinha da linha agrupada por
    // período **e tipo**, e o valor que ficava era o do primeiro tipo lido —
    // um mês com 3 aceitações e 2 reconciliações mostrava "3 crianças" ou "2",
    // conforme a ordem em que o banco devolvesse as linhas.
    const [byType, unique] = await Promise.all([
      this.baseQuery(filters)
        .select(format, 'period')
        .addSelect('ac.decision', 'decision')
        .addSelect('COUNT(DISTINCT child.id)', 'totalDecisions')
        .groupBy(format)
        .addGroupBy('ac.decision')
        .orderBy('period', 'DESC')
        .getRawMany<AcceptedChristsByPeriodRaw>(),
      this.baseQuery(filters)
        .select(format, 'period')
        .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
        .groupBy(format)
        .getRawMany<{ period: string; uniqueChildren: string }>(),
    ]);

    const uniqueByPeriod = new Map(
      unique.map((row) => [String(row.period), toCount(row.uniqueChildren)]),
    );

    const periodMap = new Map<
      string,
      {
        period: string;
        totalDecisions: number;
        byDecisionType: Record<string, number>;
        uniqueChildren: number;
      }
    >();

    byType.forEach((row) => {
      const period = String(row.period);
      const periodData = periodMap.get(period) ?? {
        period,
        totalDecisions: 0,
        byDecisionType: {},
        uniqueChildren: uniqueByPeriod.get(period) ?? 0,
      };

      const count = toCount(row.totalDecisions);
      periodData.totalDecisions += count;
      periodData.byDecisionType[row.decision] = count;
      periodMap.set(period, periodData);
    });

    return Array.from(periodMap.values());
  }

  /**
   * As decisões mais recentes, uma por linha.
   *
   * É a única consulta que mostra decisão sem tipo: aqui não há total a
   * distorcer, e esconder o registro impediria alguém de achá-lo para corrigir.
   */
  async getRecentAcceptedChrists(
    filters: AcceptedChristsStatsQueryDto,
    limit: number = 10,
  ) {
    const results = await this.baseQuery(filters, { includeUnspecified: true })
      .addSelect('child')
      .orderBy('ac.createdAt', 'DESC')
      .limit(limit)
      .getMany();

    return results.map((ac) => ({
      id: ac.id,
      childId: ac.child.id,
      childName: ac.child.name,
      decision: ac.decision,
      createdAt: ac.createdAt,
      notes: ac.notes,
    }));
  }

  async getAcceptedChristsByGender(filters: AcceptedChristsStatsQueryDto) {
    const results = await this.baseQuery(filters)
      .select('child.gender', 'gender')
      .addSelect(DISTINCT_ACCEPTED_CHILDREN_SQL, 'accepted')
      .addSelect(DISTINCT_RECONCILED_CHILDREN_SQL, 'reconciled')
      .groupBy('child.gender')
      .getRawMany<AcceptedChristsByGenderRaw>();

    return results.map((row) => {
      const accepted = toCount(row.accepted);
      const reconciled = toCount(row.reconciled);

      return {
        gender: row.gender,
        total: accepted + reconciled,
        accepted,
        reconciled,
      };
    });
  }

  /** Decisões no recorte com a criança carregada, para agrupar em memória. */
  private async findDecisionsWithChild(
    filters: AcceptedChristsStatsQueryDto,
  ): Promise<AcceptedChristEntity[]> {
    return this.baseQuery(filters).addSelect('child').getMany();
  }

  /** Agrupa as decisões pela chave da criança, uma criança por tipo. */
  private groupDecisions(
    decisions: readonly AcceptedChristEntity[],
    keyOf: (decision: AcceptedChristEntity) => string,
  ): Map<string, DecisionGroup> {
    const groups = new Map<string, DecisionGroup>();

    decisions.forEach((ac) => {
      const key = keyOf(ac);
      const group = groups.get(key) ?? emptyDecisionGroup();

      if (ac.decision === DecisionType.ACCEPTED)
        group.accepted.add(ac.child.id);
      if (ac.decision === DecisionType.RECONCILED) {
        group.reconciled.add(ac.child.id);
      }
      group.monthsByChild.set(
        ac.child.id,
        countMonthsParticipating(ac.child.joinedAt),
      );
      groups.set(key, group);
    });

    return groups;
  }

  async getAcceptedChristsByAgeGroup(filters: AcceptedChristsStatsQueryDto) {
    const decisions = await this.findDecisionsWithChild(filters);
    const groups = this.groupDecisions(decisions, (ac) =>
      toAgeGroup(ageInYears(ac.child.birthDate)),
    );

    return Array.from(groups.entries()).map(([ageGroup, group]) => ({
      ageGroup,
      total: group.accepted.size + group.reconciled.size,
      accepted: group.accepted.size,
      reconciled: group.reconciled.size,
    }));
  }

  async getAcceptedChristsByClub(filters: AcceptedChristsStatsQueryDto) {
    const results = await this.baseQuery(filters)
      .andWhere('club.id IS NOT NULL')
      .select('club.id', 'clubId')
      .addSelect('club.number', 'clubNumber')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(DISTINCT_ACCEPTED_CHILDREN_SQL, 'accepted')
      .addSelect(DISTINCT_RECONCILED_CHILDREN_SQL, 'reconciled')
      .groupBy('club.id')
      .addGroupBy('club.number')
      .orderBy('clubNumber', 'ASC')
      .getRawMany<AcceptedChristsByClubRaw>();

    return results.map((row) => {
      const accepted = toCount(row.accepted);
      const reconciled = toCount(row.reconciled);

      return {
        clubId: row.clubId,
        clubNumber: parseInt(row.clubNumber),
        total: accepted + reconciled,
        uniqueChildren: toCount(row.uniqueChildren),
        accepted,
        reconciled,
      };
    });
  }

  /**
   * Decisões por clubinho no recorte, para o índice de desempenho.
   *
   * Uma consulta só para o ranking e para a listagem de clubinhos: as duas
   * telas mostravam "decisões" do mesmo clubinho com números diferentes porque
   * cada uma tinha a sua, e uma delas ignorava o recorte de datas.
   */
  async getDecisionCountsByClub(
    clubIds: readonly string[],
    filters: Pick<AcceptedChristsStatsQueryDto, 'startDate' | 'endDate'>,
  ): Promise<Map<string, ClubDecisionCounts>> {
    if (clubIds.length === 0) return new Map();

    const rows = await this.baseQuery({
      startDate: filters.startDate,
      endDate: filters.endDate,
    })
      .andWhere('club.id IN (:...decisionClubIds)', {
        decisionClubIds: clubIds,
      })
      .select('club.id', 'clubId')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(DISTINCT_ACCEPTED_CHILDREN_SQL, 'accepted')
      .addSelect(DISTINCT_RECONCILED_CHILDREN_SQL, 'reconciled')
      .groupBy('club.id')
      .getRawMany<AcceptedChristsByClubRaw>();

    return new Map(
      rows.map((row) => [
        row.clubId,
        {
          totalDecisions: toCount(row.accepted) + toCount(row.reconciled),
          childrenWithDecisions: toCount(row.uniqueChildren),
        },
      ]),
    );
  }

  async getAcceptedChristsByCity(filters: AcceptedChristsStatsQueryDto) {
    const results = await this.baseQuery(filters)
      .andWhere('address.city IS NOT NULL')
      .select('address.city', 'city')
      .addSelect('address.state', 'state')
      .addSelect('COUNT(DISTINCT child.id)', 'uniqueChildren')
      .addSelect(DISTINCT_ACCEPTED_CHILDREN_SQL, 'accepted')
      .addSelect(DISTINCT_RECONCILED_CHILDREN_SQL, 'reconciled')
      .groupBy('address.city')
      .addGroupBy('address.state')
      .getRawMany<AcceptedChristsByCityRaw>();

    return results
      .map((row) => {
        const accepted = toCount(row.accepted);
        const reconciled = toCount(row.reconciled);

        return {
          city: row.city,
          state: row.state,
          total: accepted + reconciled,
          uniqueChildren: toCount(row.uniqueChildren),
          accepted,
          reconciled,
        };
      })
      .sort((a, b) => b.total - a.total || a.city.localeCompare(b.city));
  }

  async getAcceptedChristsByParticipationTime(
    filters: AcceptedChristsStatsQueryDto,
  ) {
    const decisions = await this.findDecisionsWithChild(filters);
    const groups = this.groupDecisions(decisions, (ac) =>
      toParticipationTimeRange(countMonthsParticipating(ac.child.joinedAt)),
    );

    return PARTICIPATION_TIME_RANGES.filter((range) => groups.has(range)).map(
      (range) => {
        const group = groups.get(range)!;
        const months = Array.from(group.monthsByChild.values());

        return {
          timeRange: range,
          total: group.accepted.size + group.reconciled.size,
          uniqueChildren: group.monthsByChild.size,
          accepted: group.accepted.size,
          reconciled: group.reconciled.size,
          avgMonthsParticipating: averageOf(months, (value) => value),
        };
      },
    );
  }

  async getAcceptedChristsTimeSeries(filters: AcceptedChristsStatsQueryDto) {
    const format = this.periodFormat(filters.groupBy || 'month');

    const results = await this.baseQuery(filters)
      .select(format, 'period')
      .addSelect(DISTINCT_ACCEPTED_CHILDREN_SQL, 'accepted')
      .addSelect(DISTINCT_RECONCILED_CHILDREN_SQL, 'reconciled')
      .groupBy(format)
      .orderBy('period', 'ASC')
      .getRawMany<AcceptedChristsTimeSeriesRaw>();

    return results.map((row) => {
      const accepted = toCount(row.accepted);
      const reconciled = toCount(row.reconciled);

      return {
        date: row.period,
        total: accepted + reconciled,
        accepted,
        reconciled,
      };
    });
  }
}
