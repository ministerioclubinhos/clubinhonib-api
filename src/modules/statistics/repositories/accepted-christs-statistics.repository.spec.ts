import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AcceptedChristEntity } from '../../accepted-christs/entities/accepted-christ.entity';
import { DecisionType } from '../../accepted-christs/enums/decision-type.enum';
import {
  DISTINCT_ACCEPTED_CHILDREN_SQL,
  ENROLLED_AT_DECISION_DATE_SQL,
} from '../constants';
import { AcceptedChristsStatsQueryDto } from '../dto/accepted-christs-stats-query.dto';
import { StatisticsFiltersService } from '../services/statistics-filters.service';
import { AcceptedChristsStatisticsRepository } from './accepted-christs-statistics.repository';

type BuilderMock = Record<string, jest.Mock>;

/** Query builder de mentira: encadeáveis devolvem o próprio objeto. */
function queryBuilderMock(): BuilderMock {
  const builder: BuilderMock = {};
  for (const method of [
    'leftJoin',
    'where',
    'andWhere',
    'select',
    'addSelect',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'limit',
  ]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.getRawMany = jest.fn().mockResolvedValue([]);
  builder.getRawOne = jest.fn().mockResolvedValue(undefined);
  builder.getMany = jest.fn().mockResolvedValue([]);
  return builder;
}

describe('AcceptedChristsStatisticsRepository', () => {
  const acceptedChristsRepository = { createQueryBuilder: jest.fn() };

  let repository: AcceptedChristsStatisticsRepository;
  /** Um builder por consulta, na ordem em que foram criados. */
  let builders: BuilderMock[];

  /** Prepara os builders que as próximas consultas vão receber, em ordem. */
  const prepare = (...setup: ((builder: BuilderMock) => void)[]) => {
    setup.forEach((configure) => {
      const builder = queryBuilderMock();
      configure(builder);
      acceptedChristsRepository.createQueryBuilder.mockReturnValueOnce(builder);
      builders.push(builder);
    });
  };

  const condicoes = (builder: BuilderMock) =>
    builder.andWhere.mock.calls.map((call: unknown[]) => String(call[0]));

  beforeEach(async () => {
    jest.clearAllMocks();
    builders = [];
    acceptedChristsRepository.createQueryBuilder.mockImplementation(() => {
      const builder = queryBuilderMock();
      builders.push(builder);
      return builder;
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        AcceptedChristsStatisticsRepository,
        StatisticsFiltersService,
        {
          provide: getRepositoryToken(AcceptedChristEntity),
          useValue: acceptedChristsRepository,
        },
      ],
    }).compile();

    repository = moduleRef.get(AcceptedChristsStatisticsRepository);
  });

  describe('escopo comum', () => {
    const comCidade: AcceptedChristsStatsQueryDto = { city: 'Manaus' };

    it.each([
      [
        'getAcceptedChristsOverallStats',
        () => repository.getAcceptedChristsOverallStats(comCidade),
      ],
      [
        'getAcceptedChristsByPeriod',
        () => repository.getAcceptedChristsByPeriod(comCidade),
      ],
      [
        'getRecentAcceptedChrists',
        () => repository.getRecentAcceptedChrists(comCidade),
      ],
      [
        'getAcceptedChristsTimeSeries',
        () => repository.getAcceptedChristsTimeSeries(comCidade),
      ],
      [
        'getAcceptedChristsByGender',
        () => repository.getAcceptedChristsByGender(comCidade),
      ],
      [
        'getAcceptedChristsByClub',
        () => repository.getAcceptedChristsByClub(comCidade),
      ],
    ])(
      '%s junta o endereço e aplica clubinho ativo + matrícula no dia da decisão',
      async (_nome, consulta) => {
        await consulta();

        expect(builders.length).toBeGreaterThan(0);
        builders.forEach((builder) => {
          // Sem o join, o filtro de cidade era "unknown column address.city".
          expect(builder.leftJoin).toHaveBeenCalledWith(
            'child.address',
            'address',
          );
          expect(condicoes(builder)).toEqual(
            expect.arrayContaining([
              'club.isActive = :clubActive',
              ENROLLED_AT_DECISION_DATE_SQL,
              'address.city = :city',
            ]),
          );
        });
      },
    );

    it('os totais deixam de fora a decisão sem tipo; a lista de recentes não', async () => {
      await repository.getAcceptedChristsTimeSeries({});
      expect(condicoes(builders[0])).toContain('ac.decision IS NOT NULL');

      builders = [];
      await repository.getRecentAcceptedChrists({});
      expect(condicoes(builders[0])).not.toContain('ac.decision IS NOT NULL');
    });
  });

  describe('getAcceptedChristsOverallStats', () => {
    it('conta crianças distintas por tipo e expõe as sem tipo à parte', async () => {
      prepare(
        (porTipo) =>
          porTipo.getRawMany.mockResolvedValue([
            { decision: DecisionType.ACCEPTED, totalDecisions: '11' },
            { decision: DecisionType.RECONCILED, totalDecisions: '4' },
          ]),
        (unicas) =>
          unicas.getRawOne.mockResolvedValue({ uniqueChildren: '12' }),
        (semTipo) => semTipo.getRawOne.mockResolvedValue({ total: '10' }),
      );

      const geral = await repository.getAcceptedChristsOverallStats({});

      expect(geral).toEqual({
        // 11 + 4: as 10 sem tipo não entram no total.
        totalDecisions: 15,
        uniqueChildren: 12,
        byDecisionType: { ACCEPTED: 11, RECONCILED: 4 },
        unspecifiedDecisions: 10,
      });
      // Por criança, não por linha: registro duplicado não conta duas vezes.
      expect(builders[0].addSelect).toHaveBeenCalledWith(
        'COUNT(DISTINCT child.id)',
        'totalDecisions',
      );
      // A contagem das sem tipo olha só para elas, no mesmo escopo.
      expect(condicoes(builders[2])).toContain('ac.decision IS NULL');
      expect(condicoes(builders[2])).not.toContain('ac.decision IS NOT NULL');
    });
  });

  describe('getAcceptedChristsByPeriod', () => {
    it('uniqueChildren vem da consulta por período, não da linha de um dos tipos', async () => {
      // Março: 3 crianças aceitaram e 2 reconciliaram, uma delas nas duas
      // listas — 4 crianças distintas. Antes saía 3 ou 2, conforme a ordem
      // em que o banco devolvesse as linhas.
      prepare(
        (porTipo) =>
          porTipo.getRawMany.mockResolvedValue([
            {
              period: '2026-03',
              decision: DecisionType.ACCEPTED,
              totalDecisions: '3',
            },
            {
              period: '2026-03',
              decision: DecisionType.RECONCILED,
              totalDecisions: '2',
            },
          ]),
        (unicas) =>
          unicas.getRawMany.mockResolvedValue([
            { period: '2026-03', uniqueChildren: '4' },
          ]),
      );

      const periodos = await repository.getAcceptedChristsByPeriod({});

      expect(periodos).toEqual([
        {
          period: '2026-03',
          totalDecisions: 5,
          byDecisionType: { ACCEPTED: 3, RECONCILED: 2 },
          uniqueChildren: 4,
        },
      ]);
    });
  });

  describe('agrupamentos', () => {
    it('total é sempre aceitou + reconciliou, por criança distinta', async () => {
      prepare((builder) =>
        builder.getRawMany.mockResolvedValue([
          { gender: 'F', accepted: '6', reconciled: '2' },
        ]),
      );

      const porGenero = await repository.getAcceptedChristsByGender({});

      expect(porGenero).toEqual([
        { gender: 'F', total: 8, accepted: 6, reconciled: 2 },
      ]);
      expect(builders[0].addSelect).toHaveBeenCalledWith(
        DISTINCT_ACCEPTED_CHILDREN_SQL,
        'accepted',
      );
    });

    it('por faixa etária, a mesma criança conta uma vez por tipo', async () => {
      const crianca = { id: 'c1', birthDate: '2016-01-01', joinedAt: null };
      prepare((builder) =>
        builder.getMany.mockResolvedValue([
          // Registro de aceitação duplicado (legado) da mesma criança.
          { decision: DecisionType.ACCEPTED, child: crianca },
          { decision: DecisionType.ACCEPTED, child: crianca },
          { decision: DecisionType.RECONCILED, child: crianca },
        ]),
      );

      const [faixa] = await repository.getAcceptedChristsByAgeGroup({});

      expect(faixa).toMatchObject({ total: 2, accepted: 1, reconciled: 1 });
    });
  });

  describe('getDecisionCountsByClub', () => {
    it('sem clubinho não consulta', async () => {
      const mapa = await repository.getDecisionCountsByClub([], {});

      expect(mapa.size).toBe(0);
      expect(
        acceptedChristsRepository.createQueryBuilder,
      ).not.toHaveBeenCalled();
    });

    it('respeita o recorte de datas e devolve crianças distintas', async () => {
      prepare((builder) =>
        builder.getRawMany.mockResolvedValue([
          { clubId: 'c1', uniqueChildren: '3', accepted: '3', reconciled: '1' },
        ]),
      );

      const mapa = await repository.getDecisionCountsByClub(['c1'], {
        startDate: '2026-09-01',
        endDate: '2026-09-30',
      });

      expect(mapa.get('c1')).toEqual({
        totalDecisions: 4,
        childrenWithDecisions: 3,
      });
      expect(condicoes(builders[0])).toEqual(
        expect.arrayContaining([
          'ac.createdAt >= :startDate',
          'ac.createdAt < :endDateExclusive',
        ]),
      );
    });
  });
});
