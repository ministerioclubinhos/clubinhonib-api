import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { ENROLLED_AT_PAGELA_DATE_SQL } from '../constants';
import { PagelasStatsQueryDto } from '../dto/pagelas-stats-query.dto';
import { StatisticsFiltersService } from '../services/statistics-filters.service';
import { ExpectedChildRow, ExpectedSummary, ExpectedWeek } from '../types';
import { ExpectedChildrenRepository } from './expected-children.repository';
import { PagelasStatisticsRepository } from './pagelas-statistics.repository';

/** Query builder de mentira: encadeáveis devolvem o próprio objeto. */
function queryBuilderMock(result: { rawMany?: unknown[]; rawOne?: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of [
    'leftJoin',
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'select',
    'addSelect',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'addOrderBy',
    'limit',
  ]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.getRawMany = jest.fn().mockResolvedValue(result.rawMany ?? []);
  builder.getRawOne = jest.fn().mockResolvedValue(result.rawOne);
  builder.getMany = jest.fn().mockResolvedValue([]);
  return builder;
}

type KeyOf = (child: ExpectedChildRow, week: ExpectedWeek) => string | null;

describe('PagelasStatisticsRepository', () => {
  const pagelasRepository = { createQueryBuilder: jest.fn() };
  const expectedChildrenRepository = { summarizeForPagelas: jest.fn() };

  let repository: PagelasStatisticsRepository;
  let builder: Record<string, jest.Mock>;

  const esperado = (entries: [string, ExpectedSummary][]) =>
    expectedChildrenRepository.summarizeForPagelas.mockResolvedValue(
      new Map(entries),
    );

  beforeEach(async () => {
    jest.clearAllMocks();
    builder = queryBuilderMock({});
    pagelasRepository.createQueryBuilder.mockReturnValue(builder);
    expectedChildrenRepository.summarizeForPagelas.mockResolvedValue(new Map());

    const moduleRef = await Test.createTestingModule({
      providers: [
        PagelasStatisticsRepository,
        StatisticsFiltersService,
        {
          provide: getRepositoryToken(PagelaEntity),
          useValue: pagelasRepository,
        },
        {
          provide: ExpectedChildrenRepository,
          useValue: expectedChildrenRepository,
        },
      ],
    }).compile();

    repository = moduleRef.get(PagelasStatisticsRepository);
  });

  const condicoes = () =>
    builder.andWhere.mock.calls.map((call: unknown[]) => String(call[0]));

  describe('filtro de cidade', () => {
    /**
     * Regressão: estas três consultas recebiam filtro de cidade, estado e
     * bairro sem juntar o endereço da criança, e o banco respondia "unknown
     * column address.city".
     */
    const comCidade: PagelasStatsQueryDto = { city: 'Manaus' };

    it.each([
      [
        'getPagelasWeeklyStats',
        () => repository.getPagelasWeeklyStats(comCidade),
      ],
      [
        'getPagelasOverallStats',
        () => repository.getPagelasOverallStats(comCidade),
      ],
      [
        'getPagelasTopPerformers',
        () => repository.getPagelasTopPerformers(comCidade),
      ],
    ])('%s junta o endereço da criança', async (_nome, consulta) => {
      await consulta();

      expect(builder.leftJoin).toHaveBeenCalledWith('child.address', 'address');
      expect(condicoes()).toContain('address.city = :city');
    });
  });

  describe('histórico não depende do isActive de hoje', () => {
    it.each([
      ['getPagelasWeeklyStats', () => repository.getPagelasWeeklyStats({})],
      ['getPagelasOverallStats', () => repository.getPagelasOverallStats({})],
      ['getPagelasTopPerformers', () => repository.getPagelasTopPerformers({})],
      ['getPagelasByGender', () => repository.getPagelasByGender({})],
      ['getPagelasByAgeGroup', () => repository.getPagelasByAgeGroup({})],
      ['getPagelasByClub', () => repository.getPagelasByClub({})],
      ['getPagelasByTeacher', () => repository.getPagelasByTeacher({})],
      // Esta era a única sem filtro nenhum de criança: divergia das irmãs.
      ['getPagelasTimeSeries', () => repository.getPagelasTimeSeries({})],
      ['getPagelasByCity', () => repository.getPagelasByCity({})],
      [
        'getPagelasByParticipationTime',
        () => repository.getPagelasByParticipationTime({}),
      ],
    ])('%s usa a matrícula na data da pagela', async (_nome, consulta) => {
      await consulta();

      expect(condicoes()).toContain(ENROLLED_AT_PAGELA_DATE_SQL);
      expect(condicoes().join(' ')).not.toContain('child.isActive = :isActive');
    });
  });

  describe('taxa de presença sobre os esperados', () => {
    it('geral: presentes ÷ esperados, com o denominador exposto', async () => {
      builder.getRawOne.mockResolvedValue({
        totalPagelas: '60',
        totalChildren: '10',
        totalTeachers: '2',
        presentCount: '60',
        didMeditationCount: '30',
        recitedVerseCount: '15',
      });
      esperado([['all', { slots: 80, children: 10 }]]);

      const geral = await repository.getPagelasOverallStats({});

      // 60 de 80 esperados. Na conta antiga, 60 de 60 pagelas davam 100%.
      expect(geral.averagePresenceRate).toBe(75);
      expect(geral.expectedPresences).toBe(80);
      // Meditação e versículo seguem sobre as pagelas lançadas.
      expect(geral.averageMeditationRate).toBe(50);
      expect(geral.averageVerseRecitationRate).toBe(25);
    });

    it('sem período letivo ninguém é esperado e a taxa é 0', async () => {
      builder.getRawOne.mockResolvedValue({
        totalPagelas: '5',
        presentCount: '5',
      });

      const geral = await repository.getPagelasOverallStats({});

      expect(geral.averagePresenceRate).toBe(0);
      expect(geral.expectedPresences).toBe(0);
    });

    it('por semana: cada semana com o próprio esperado', async () => {
      builder.getRawMany.mockResolvedValue([
        {
          year: '2026',
          week: '12',
          totalPagelas: '8',
          presentCount: '6',
          didMeditationCount: '4',
          recitedVerseCount: '2',
          uniqueChildren: '8',
          uniqueTeachers: '1',
        },
      ]);
      esperado([['2026-12', { slots: 10, children: 10 }]]);

      const [semana] = await repository.getPagelasWeeklyStats({});

      expect(semana.presenceRate).toBe(60);
      expect(semana.expectedPresences).toBe(10);
      expect(semana.meditationRate).toBe(50);

      // A chave do agrupamento é a semana letiva.
      const [, keyOf] = expectedChildrenRepository.summarizeForPagelas.mock
        .calls[0] as [unknown, KeyOf];
      expect(
        keyOf({} as ExpectedChildRow, { year: 2026, week: 12 } as ExpectedWeek),
      ).toBe('2026-12');
    });

    it('por clubinho: o esperado é o do próprio clubinho', async () => {
      builder.getRawMany.mockResolvedValue([
        {
          clubId: 'c1',
          clubNumber: '1',
          total: '10',
          uniqueChildren: '5',
          presentCount: '9',
          meditationCount: '0',
          verseCount: '0',
        },
      ]);
      esperado([['c1', { slots: 20, children: 5 }]]);

      const [clubinho] = await repository.getPagelasByClub({});

      expect(clubinho.presenceRate).toBe(45);
    });

    it('com filtro de professor não há esperado: vale a taxa por pagela', async () => {
      builder.getRawOne.mockResolvedValue({
        totalPagelas: '8',
        presentCount: '6',
      });
      expectedChildrenRepository.summarizeForPagelas.mockResolvedValue(null);

      const geral = await repository.getPagelasOverallStats({
        teacherId: 't-1',
      });

      expect(geral.averagePresenceRate).toBe(75);
      expect(geral.expectedPresences).toBe(8);
    });
  });
});
