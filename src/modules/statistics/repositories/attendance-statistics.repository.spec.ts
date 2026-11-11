import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';

import { ClubPeriodEntity } from '../../club-control/entities/club-period.entity';
import { ClubEntity } from '../../clubs/entities/club.entity';
import { PagelaEntity } from '../../pagelas/entities/pagela.entity';
import { ENROLLED_AT_PAGELA_DATE_SQL } from '../constants';
import { ExpectedChildRow } from '../types';
import { AttendanceStatisticsRepository } from './attendance-statistics.repository';
import { ExpectedChildrenRepository } from './expected-children.repository';

/**
 * Um query builder de mentira: todo método encadeável devolve o próprio
 * objeto, e os terminais devolvem o que o teste mandar.
 */
function queryBuilderMock(result: { rawMany?: unknown[]; many?: unknown[] }) {
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
  ]) {
    builder[method] = jest.fn().mockReturnValue(builder);
  }
  builder.getRawMany = jest.fn().mockResolvedValue(result.rawMany ?? []);
  builder.getMany = jest.fn().mockResolvedValue(result.many ?? []);
  return builder;
}

/** Período curto: de segunda 02/03 a sábado 28/03/2026 — quatro semanas. */
const periodo = Object.assign(new ClubPeriodEntity(), {
  year: 2026,
  startDate: '2026-03-02',
  endDate: '2026-03-28',
  isActive: true,
});

const clubinho = (overrides: Partial<ClubEntity> = {}) =>
  Object.assign(new ClubEntity(), {
    id: 'club-1',
    number: 7,
    weekday: 'saturday',
    isActive: true,
    ...overrides,
  });

const crianca = (
  id: string,
  overrides: Partial<ExpectedChildRow> = {},
): ExpectedChildRow => ({
  id,
  clubId: 'club-1',
  clubWeekday: 'saturday',
  gender: 'F',
  birthDate: '2016-01-01',
  joinedAt: null,
  isActive: true,
  deactivationDay: null,
  city: null,
  state: null,
  ...overrides,
});

const semanaComPagela = (week: number, firstDate: string) => ({
  year: '2026',
  week: String(week),
  totalPagelas: '2',
  firstDate,
  presentCount: '2',
});

describe('AttendanceStatisticsRepository', () => {
  const pagelasRepository = { createQueryBuilder: jest.fn() };
  const clubsRepository = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
  const periodsRepository = { findOne: jest.fn() };
  const expectedChildrenRepository = {
    findChildren: jest.fn(),
    findExceptions: jest.fn(),
  };

  let repository: AttendanceStatisticsRepository;

  beforeAll(() => {
    // Quarta 11/11/2026, meio-dia em Brasília: o período de março já passou.
    jest.useFakeTimers().setSystemTime(new Date('2026-11-11T15:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    clubsRepository.findOne.mockResolvedValue(clubinho());
    periodsRepository.findOne.mockResolvedValue(periodo);
    expectedChildrenRepository.findChildren.mockResolvedValue([crianca('a')]);
    expectedChildrenRepository.findExceptions.mockResolvedValue([]);
    pagelasRepository.createQueryBuilder.mockReturnValue(
      queryBuilderMock({ rawMany: [] }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceStatisticsRepository,
        {
          provide: getRepositoryToken(PagelaEntity),
          useValue: pagelasRepository,
        },
        { provide: getRepositoryToken(ClubEntity), useValue: clubsRepository },
        {
          provide: getRepositoryToken(ClubPeriodEntity),
          useValue: periodsRepository,
        },
        {
          provide: ExpectedChildrenRepository,
          useValue: expectedChildrenRepository,
        },
      ],
    }).compile();

    repository = moduleRef.get(AttendanceStatisticsRepository);
  });

  describe('analyzeClubAttendance', () => {
    it('clubinho inexistente responde com o erro de recurso do projeto', async () => {
      clubsRepository.findOne.mockResolvedValue(null);

      const erro: unknown = await repository
        .analyzeClubAttendance('nao-existe', 2026)
        .catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(AppNotFoundException);
      expect((erro as AppNotFoundException).code).toBe(
        ErrorCode.CLUB_NOT_FOUND,
      );
    });

    it('ano sem período letivo: resposta explícita, sem alerta de "0% crítico"', async () => {
      periodsRepository.findOne.mockResolvedValue(null);

      const analise = await repository.analyzeClubAttendance('club-1', 2025);

      expect(analise.period.hasAcademicPeriod).toBe(false);
      expect(analise.attendance).toMatchObject({
        weeksExpected: 0,
        weeksMissing: 0,
        attendanceRate: 0,
      });
      // Antes: `low_attendance` crítico com "0.0%" para um ano sem aula.
      expect(analise.alerts).toEqual([]);
      expect(analise.timeline).toEqual([]);
      expect(analise.note).toContain('2025');
      expect(pagelasRepository.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('o dia do clubinho é o sábado de cada semana, sem escorregar para a sexta', async () => {
      // Regressão do fuso: `new Date('2026-03-02')` é domingo à noite no
      // Brasil, e o dia do clubinho saía um dia antes.
      const analise = await repository.analyzeClubAttendance('club-1', 2026);

      expect(analise.timeline.map((semana) => semana.date)).toEqual([
        '2026-03-07',
        '2026-03-14',
        '2026-03-21',
        '2026-03-28',
      ]);
      expect(analise.timeline.map((semana) => semana.week)).toEqual([
        1, 2, 3, 4,
      ]);
    });

    it('semana sem criança esperada sai do denominador e das sequências', async () => {
      // A única criança entrou em 20/03: nas semanas 1 e 2 ninguém era
      // esperado. Antes elas contavam em `weeksExpected` sem nunca aparecerem
      // em `missingWeeks`, e a taxa saía 25% com uma só semana em falta.
      expectedChildrenRepository.findChildren.mockResolvedValue([
        crianca('a', { joinedAt: '2026-03-20' }),
      ]);
      pagelasRepository.createQueryBuilder.mockReturnValue(
        queryBuilderMock({ rawMany: [semanaComPagela(3, '2026-03-21')] }),
      );

      const analise = await repository.analyzeClubAttendance('club-1', 2026);

      expect(analise.timeline.map((s) => s.expectedChildren)).toEqual([
        0, 0, 1, 1,
      ]);
      expect(analise.attendance).toMatchObject({
        weeksExpected: 2,
        weeksWithPagela: 1,
        weeksMissing: 1,
        attendanceRate: 50,
        consecutiveWeeksPresent: 1,
        consecutiveWeeksMissing: 1,
      });
      expect(analise.missingWeeks.map((s) => s.week)).toEqual([4]);
      expect(analise.missingWeeks[0].weekRange).toEqual({
        start: '2026-03-28',
        end: '2026-04-03',
      });
    });

    it('criança desativada depois continua esperada nas semanas em que frequentava', async () => {
      expectedChildrenRepository.findChildren.mockResolvedValue([
        crianca('saiu', { isActive: false, deactivationDay: '2026-03-15' }),
      ]);

      const analise = await repository.analyzeClubAttendance('club-1', 2026);

      // Esperada em 07/03 e 14/03; depois de sair, não.
      expect(analise.timeline.map((s) => s.expectedChildren)).toEqual([
        1, 1, 0, 0,
      ]);
      expect(analise.attendance.weeksExpected).toBe(2);
    });

    it('sem nenhuma semana a cumprir não há alerta de frequência baixa', async () => {
      expectedChildrenRepository.findChildren.mockResolvedValue([]);

      const analise = await repository.analyzeClubAttendance('club-1', 2026);

      expect(analise.attendance.weeksExpected).toBe(0);
      expect(analise.alerts).toEqual([]);
    });

    it('feriado no dia do clubinho não conta como semana em falta', async () => {
      expectedChildrenRepository.findExceptions.mockResolvedValue([
        { date: '2026-03-14', isRecurrent: false },
      ]);

      const analise = await repository.analyzeClubAttendance('club-1', 2026);

      expect(analise.period.exceptionsCount).toBe(1);
      expect(analise.attendance.weeksExpected).toBe(3);
      expect(analise.missingWeeks.map((s) => s.week)).toEqual([1, 3, 4]);
    });

    it('as pagelas são filtradas pela matrícula na data, não pelo isActive de hoje', async () => {
      const builder = queryBuilderMock({ rawMany: [] });
      pagelasRepository.createQueryBuilder.mockReturnValue(builder);

      await repository.analyzeClubAttendance('club-1', 2026);

      const condicoes = builder.andWhere.mock.calls.map(
        (call: unknown[]) => call[0],
      );
      expect(condicoes).toContain(ENROLLED_AT_PAGELA_DATE_SQL);
      expect(condicoes.join(' ')).not.toContain('child.isActive = :isActive');
    });
  });

  describe('analyzeWeeklyAttendance', () => {
    const clubes = (lista: ClubEntity[]) => {
      clubsRepository.createQueryBuilder.mockReturnValue(
        queryBuilderMock({ many: lista }),
      );
    };

    it('sem período letivo devolve a resposta vazia com a explicação', async () => {
      periodsRepository.findOne.mockResolvedValue(null);

      const semana = await repository.analyzeWeeklyAttendance(2025, 3);

      expect(semana.clubs).toEqual([]);
      expect(semana.weekRange).toEqual({ start: null, end: null });
      expect(semana.note).toContain('Período letivo não cadastrado');
    });

    it('semana além do fim do período não lista clubinho nenhum', async () => {
      const semana = await repository.analyzeWeeklyAttendance(2026, 9);

      expect(semana.clubs).toEqual([]);
      expect(semana.weekRange).toEqual({
        start: '2026-04-27',
        end: '2026-05-03',
      });
      // Datas do período na mensagem, sem voltar um dia por causa do fuso.
      expect(semana.note).toContain('02/03/2026 a 28/03/2026');
    });

    it('dia do clubinho fora do período não é "faltando"', async () => {
      // O período abre na quarta 04/03: o clubinho de segunda não teve
      // encontro na semana 1, e antes aparecia como pagela em falta.
      periodsRepository.findOne.mockResolvedValue(
        Object.assign(new ClubPeriodEntity(), {
          year: 2026,
          startDate: '2026-03-04',
          endDate: '2026-03-28',
          isActive: true,
        }),
      );
      clubes([
        clubinho({ id: 'club-seg', number: 1, weekday: 'monday' as never }),
        clubinho({ id: 'club-sab', number: 2, weekday: 'saturday' as never }),
      ]);
      expectedChildrenRepository.findChildren.mockResolvedValue([
        crianca('a', { clubId: 'club-seg', clubWeekday: 'monday' }),
        crianca('b', { clubId: 'club-sab' }),
      ]);

      const semana = await repository.analyzeWeeklyAttendance(2026, 1);

      expect(semana.clubs).toEqual([
        expect.objectContaining({
          clubId: 'club-seg',
          expectedDate: '2026-03-02',
          status: 'out_of_period',
          expectedChildren: 0,
        }),
        expect.objectContaining({
          clubId: 'club-sab',
          expectedDate: '2026-03-07',
          status: 'missing',
          expectedChildren: 1,
        }),
      ]);
      // Só o de sábado devia pagela.
      expect(semana.summary).toMatchObject({
        clubsActive: 1,
        clubsMissing: 1,
      });
    });

    it('classifica ok, parcial e sem crianças pela matrícula na data', async () => {
      clubes([
        clubinho({ id: 'ok', number: 1 }),
        clubinho({ id: 'parcial', number: 2 }),
        clubinho({ id: 'vazio', number: 3 }),
      ]);
      expectedChildrenRepository.findChildren.mockResolvedValue([
        crianca('a', { clubId: 'ok' }),
        // Desativada em novembro: em março ainda era esperada.
        crianca('b', {
          clubId: 'parcial',
          isActive: false,
          deactivationDay: '2026-11-05',
        }),
        crianca('c', { clubId: 'parcial' }),
        // Só entrou em abril: em março não era esperada.
        crianca('d', { clubId: 'vazio', joinedAt: '2026-04-10' }),
      ]);
      pagelasRepository.createQueryBuilder.mockReturnValue(
        queryBuilderMock({
          rawMany: [
            { clubId: 'ok', totalPagelas: '1' },
            { clubId: 'parcial', totalPagelas: '1' },
          ],
        }),
      );

      const semana = await repository.analyzeWeeklyAttendance(2026, 2);

      expect(
        semana.clubs.map((c) => [c.clubId, c.status, c.expectedChildren]),
      ).toEqual([
        ['ok', 'ok', 1],
        ['parcial', 'partial', 2],
        ['vazio', 'inactive', 0],
      ]);
      expect(semana.summary).toMatchObject({
        clubsActive: 2,
        clubsWithPagela: 2,
        clubsMissing: 0,
        attendanceRate: 100,
      });
    });
  });
});
