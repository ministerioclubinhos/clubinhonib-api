import { ClubWeekStatus, ClubWeekTimeline } from './constants';
import { ClubWeeklySummaryWeekDto } from './dto/club-weekly-summary.dto';
import { SummaryChildRaw } from './dto/club-control-raw.dto';
import { ClubWeekException } from './types';
import {
  completionRateOf,
  countStatuses,
  countsOf,
  findExceptionForDate,
  highlightsOf,
  isChildCountedOn,
  sumCounts,
  toClubWeekStatus,
  weekTimelineOf,
} from './weekly-summary.utils';

const child = (overrides: Partial<SummaryChildRaw> = {}): SummaryChildRaw => ({
  childId: 'child-1',
  clubId: 'club-1',
  isActive: true,
  joinedAt: null,
  ...overrides,
});

const week = (
  overrides: Partial<ClubWeeklySummaryWeekDto> = {},
): ClubWeeklySummaryWeekDto => ({
  week: 1,
  startDate: '2026-03-02',
  endDate: '2026-03-07',
  timeline: ClubWeekTimeline.Past,
  counts: countsOf(10, 10, 9),
  statusCounts: countStatuses([]),
  clubs: [],
  ...overrides,
});

describe('toClubWeekStatus', () => {
  it('reconhece os status que o ClubStatusService devolve', () => {
    expect(toClubWeekStatus('ok')).toBe(ClubWeekStatus.Ok);
    expect(toClubWeekStatus('partial')).toBe(ClubWeekStatus.Partial);
    expect(toClubWeekStatus('missing')).toBe(ClubWeekStatus.Missing);
    expect(toClubWeekStatus('pending')).toBe(ClubWeekStatus.Pending);
    expect(toClubWeekStatus('exception')).toBe(ClubWeekStatus.Exception);
  });

  it('trata um status desconhecido como pendente', () => {
    // Neutro de propósito: não acusa falta nem afirma que a semana fechou.
    expect(toClubWeekStatus('algo_novo')).toBe(ClubWeekStatus.Pending);
  });
});

describe('weekTimelineOf', () => {
  it('separa passado, presente e futuro', () => {
    expect(weekTimelineOf(3, 5)).toBe(ClubWeekTimeline.Past);
    expect(weekTimelineOf(5, 5)).toBe(ClubWeekTimeline.Current);
    expect(weekTimelineOf(7, 5)).toBe(ClubWeekTimeline.Future);
  });

  it('sem semana corrente, nenhuma semana é futura', () => {
    // Hoje fora do período letivo: é a leitura de `getWeekType`.
    expect(weekTimelineOf(40, null)).toBe(ClubWeekTimeline.Past);
  });
});

describe('isChildCountedOn', () => {
  it('deixa de fora quem não frequenta mais', () => {
    expect(isChildCountedOn(child({ isActive: false }), '2026-03-04')).toBe(
      false,
    );
  });

  it('deixa de fora quem entrou depois do dia do clubinho', () => {
    // Cobrar a pagela de uma semana anterior à matrícula inventaria uma falta.
    expect(
      isChildCountedOn(child({ joinedAt: '2026-03-10' }), '2026-03-04'),
    ).toBe(false);
  });

  it('conta quem entrou no próprio dia', () => {
    expect(
      isChildCountedOn(child({ joinedAt: '2026-03-04' }), '2026-03-04'),
    ).toBe(true);
  });

  it('sem data de entrada ou sem data esperada, conta', () => {
    expect(isChildCountedOn(child(), '2026-03-04')).toBe(true);
    expect(isChildCountedOn(child({ joinedAt: '2026-03-10' }), null)).toBe(
      true,
    );
  });
});

describe('findExceptionForDate', () => {
  const natal: ClubWeekException = {
    exceptionDate: '2024-12-25',
    reason: 'Natal',
    isRecurrent: true,
  };
  const evento: ClubWeekException = {
    exceptionDate: '2026-04-15',
    reason: 'Evento da igreja',
    isRecurrent: false,
  };

  it('prefere a data exata', () => {
    expect(findExceptionForDate([natal, evento], '2026-04-15')).toBe(evento);
  });

  it('cai na recorrente de mesmo dia e mês', () => {
    expect(findExceptionForDate([natal, evento], '2026-12-25')).toBe(natal);
  });

  it('a recorrente mais recente ganha', () => {
    const antiga: ClubWeekException = {
      exceptionDate: '2020-12-25',
      reason: 'Natal antigo',
      isRecurrent: true,
    };
    expect(findExceptionForDate([antiga, natal], '2026-12-25')).toBe(natal);
  });

  it('não recorrente não vale para outro ano', () => {
    expect(findExceptionForDate([evento], '2027-04-15')).toBeNull();
  });

  it('sem data esperada não há exceção a procurar', () => {
    expect(findExceptionForDate([natal], null)).toBeNull();
  });
});

describe('completionRateOf', () => {
  it('arredonda para uma casa decimal', () => {
    expect(completionRateOf(7, 9)).toBe(77.8);
  });

  it('sem criança considerada devolve zero, e não NaN', () => {
    expect(completionRateOf(0, 0)).toBe(0);
  });
});

describe('sumCounts', () => {
  it('recalcula o percentual sobre o total, e não pela média das partes', () => {
    // 1 de 1 e 0 de 9 é 10%, não 50%.
    expect(sumCounts([countsOf(1, 1, 1), countsOf(9, 0, 0)])).toEqual({
      children: 10,
      childrenWithPagela: 1,
      childrenMissing: 9,
      childrenPresent: 1,
      completionRate: 10,
    });
  });

  it('sem partes devolve tudo zerado', () => {
    expect(sumCounts([])).toEqual({
      children: 0,
      childrenWithPagela: 0,
      childrenMissing: 0,
      childrenPresent: 0,
      completionRate: 0,
    });
  });
});

describe('countStatuses', () => {
  it('conta um clubinho em cada situação', () => {
    const cell = (status: ClubWeekStatus) => ({
      clubId: 'club-1',
      clubNumber: 1,
      status,
      expectedDate: '2026-03-04',
      exceptionReason: null,
      counts: countsOf(0, 0, 0),
    });

    expect(
      countStatuses([
        cell(ClubWeekStatus.Ok),
        cell(ClubWeekStatus.Ok),
        cell(ClubWeekStatus.Missing),
        cell(ClubWeekStatus.OutOfPeriod),
      ]),
    ).toEqual({
      ok: 2,
      partial: 0,
      missing: 1,
      pending: 0,
      exception: 0,
      inactive: 0,
      outOfPeriod: 1,
    });
  });
});

describe('highlightsOf', () => {
  it('ignora as semanas futuras', () => {
    // Elas nascem sem pagela: somá-las derrubaria a média do ano inteiro.
    const highlights = highlightsOf([
      week({ week: 1, counts: countsOf(10, 10, 10) }),
      week({
        week: 2,
        timeline: ClubWeekTimeline.Future,
        counts: countsOf(10, 0, 0),
      }),
    ]);

    expect(highlights.weeksElapsed).toBe(1);
    expect(highlights.counts.completionRate).toBe(100);
  });

  it('melhor e pior semana ignoram semana sem criança a atender', () => {
    // Uma semana de recesso sairia sempre como a pior, com 0%.
    const highlights = highlightsOf([
      week({ week: 1, counts: countsOf(10, 9, 9) }),
      week({ week: 2, counts: countsOf(0, 0, 0) }),
      week({ week: 3, counts: countsOf(10, 4, 4) }),
    ]);

    expect(highlights.bestWeek).toBe(1);
    expect(highlights.worstWeek).toBe(3);
  });

  it('conta as semanas em que algum clubinho ficou devendo', () => {
    const pendente = week({
      week: 1,
      clubs: [
        {
          clubId: 'club-1',
          clubNumber: 1,
          status: ClubWeekStatus.Partial,
          expectedDate: '2026-03-04',
          exceptionReason: null,
          counts: countsOf(10, 7, 7),
        },
      ],
    });
    const emDia = week({
      week: 2,
      clubs: [
        {
          clubId: 'club-1',
          clubNumber: 1,
          status: ClubWeekStatus.Ok,
          expectedDate: '2026-03-11',
          exceptionReason: null,
          counts: countsOf(10, 10, 10),
        },
      ],
    });

    expect(highlightsOf([pendente, emDia]).weeksWithPendency).toBe(1);
  });

  it('sem semana nenhuma devolve o retrato vazio', () => {
    expect(highlightsOf([])).toEqual({
      weeksElapsed: 0,
      counts: countsOf(0, 0, 0),
      bestWeek: null,
      worstWeek: null,
      weeksWithPendency: 0,
    });
  });
});
