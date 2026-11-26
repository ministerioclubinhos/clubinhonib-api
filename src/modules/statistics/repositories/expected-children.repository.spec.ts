import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { ChildEntity } from '../../children/entities/child.entity';
import { ClubExceptionEntity } from '../../club-control/entities/club-exception.entity';
import { ClubPeriodEntity } from '../../club-control/entities/club-period.entity';
import { CHILD_DEACTIVATION_DAY_SQL } from '../constants';
import { StatisticsFiltersService } from '../services/statistics-filters.service';
import { ExpectedChildrenRepository } from './expected-children.repository';

/** Query builder de mentira: encadeáveis devolvem o próprio objeto. */
function queryBuilderMock(rows: unknown[]) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of [
    'innerJoin',
    'leftJoin',
    'where',
    'andWhere',
    'select',
    'addSelect',
  ]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.getRawMany = jest.fn().mockResolvedValue(rows);
  return builder;
}

const linha = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  clubId: 'club-1',
  clubWeekday: 'saturday',
  gender: 'F',
  birthDate: '2016-01-01',
  joinedAt: null,
  isActive: 1,
  deactivationDay: null,
  city: null,
  state: null,
  ...overrides,
});

describe('ExpectedChildrenRepository', () => {
  const childrenRepository = { createQueryBuilder: jest.fn() };
  const periodsRepository = { find: jest.fn() };
  const exceptionsRepository = { find: jest.fn() };

  let repository: ExpectedChildrenRepository;
  let builder: Record<string, jest.Mock>;

  beforeAll(() => {
    // Quarta 11/11/2026, meio-dia em Brasília.
    jest.useFakeTimers().setSystemTime(new Date('2026-11-11T15:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    builder = queryBuilderMock([linha('a')]);
    childrenRepository.createQueryBuilder.mockReturnValue(builder);
    periodsRepository.find.mockResolvedValue([
      { year: 2026, startDate: '2026-03-02', endDate: '2026-12-19' },
    ]);
    exceptionsRepository.find.mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpectedChildrenRepository,
        StatisticsFiltersService,
        {
          provide: getRepositoryToken(ChildEntity),
          useValue: childrenRepository,
        },
        {
          provide: getRepositoryToken(ClubPeriodEntity),
          useValue: periodsRepository,
        },
        {
          provide: getRepositoryToken(ClubExceptionEntity),
          useValue: exceptionsRepository,
        },
      ],
    }).compile();

    repository = moduleRef.get(ExpectedChildrenRepository);
  });

  describe('findChildren', () => {
    it('traz ativas e inativas de clubinho ativo, com o dia de saída resolvido no banco', async () => {
      await repository.findChildren({});

      expect(builder.where).toHaveBeenCalledWith(
        'club.isActive = :clubActive',
        { clubActive: true },
      );
      // Nenhum filtro pelo `isActive` da criança: quem saiu ainda conta no
      // passado.
      const condicoes = builder.andWhere.mock.calls
        .map((call: unknown[]) => String(call[0]))
        .join(' ');
      expect(condicoes).not.toContain('child.isActive');
      // Legado sem `deactivatedAt` cai no dia da última alteração.
      expect(builder.addSelect).toHaveBeenCalledWith(
        `DATE_FORMAT(${CHILD_DEACTIVATION_DAY_SQL}, '%Y-%m-%d')`,
        'deactivationDay',
      );
    });

    it('criança ativa não tem dia de saída, mesmo que o banco devolva um', async () => {
      builder.getRawMany.mockResolvedValue([
        linha('ativa', { isActive: 1, deactivationDay: '2026-05-01' }),
        linha('inativa', { isActive: 0, deactivationDay: '2026-05-01' }),
      ]);

      const criancas = await repository.findChildren({});

      expect(criancas[0]).toMatchObject({
        isActive: true,
        deactivationDay: null,
      });
      expect(criancas[1]).toMatchObject({
        isActive: false,
        deactivationDay: '2026-05-01',
      });
    });

    it('aplica o mesmo recorte de crianças que o numerador', async () => {
      await repository.findChildren({ clubId: 'club-1', city: 'Manaus' });

      const condicoes = builder.andWhere.mock.calls.map((call: unknown[]) =>
        String(call[0]),
      );
      expect(condicoes).toEqual(
        expect.arrayContaining([
          'child.club.id = :clubId',
          'address.city = :city',
        ]),
      );
    });
  });

  describe('summarize', () => {
    it('conta uma presença esperada por sábado já passado do recorte', async () => {
      // Sábados de outubro de 2026: 3, 10, 17, 24 e 31.
      const esperado = await repository.summarize(
        { startDate: '2026-10-01', endDate: '2026-10-31' },
        (child) => child.clubId,
      );

      expect(esperado.get('club-1')).toEqual({ slots: 5, children: 1 });
    });

    it('não espera ninguém em dia que ainda não chegou', async () => {
      // De 01/11 a 30/11 só 07/11 já passou (hoje é 11/11).
      const esperado = await repository.summarize(
        { startDate: '2026-11-01', endDate: '2026-11-30' },
        (child) => child.clubId,
      );

      expect(esperado.get('club-1')?.slots).toBe(1);
    });

    it('filtra por semana letiva e só olha períodos ativos do ano', async () => {
      const esperado = await repository.summarize(
        { year: 2026, week: 3 },
        (_child, week) => `${week.year}-${week.week}`,
      );

      expect(periodsRepository.find).toHaveBeenCalledWith({
        where: { year: 2026, isActive: true },
      });
      expect(Array.from(esperado.keys())).toEqual(['2026-3']);
    });

    it('sem período letivo o resultado é vazio', async () => {
      periodsRepository.find.mockResolvedValue([]);

      const esperado = await repository.summarize({}, (child) => child.clubId);

      expect(esperado.size).toBe(0);
    });
  });

  describe('summarizeForPagelas', () => {
    it('com filtro de professor não há esperado', async () => {
      await expect(
        repository.summarizeForPagelas({ teacherId: 't-1' }, () => 'all'),
      ).resolves.toBeNull();
      expect(childrenRepository.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
