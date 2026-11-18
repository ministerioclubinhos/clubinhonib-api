import {
  ExpectedChild,
  ExpectedWeek,
  ExpectedWindow,
  EnrollmentRecord,
} from '../types';
import {
  addDaysToDateOnly,
  clubDayInWeek,
  countEnrolledAt,
  isClubDayExpected,
  isExceptionDay,
  listAcademicWeeks,
  mondayOf,
  summarizeExpected,
  wasEnrolledAt,
} from './enrollment.utils';

/** Período de 2026: começa numa segunda, termina num sábado — 42 semanas. */
const PERIODO = { year: 2026, startDate: '2026-03-02', endDate: '2026-12-19' };

const ativa: EnrollmentRecord = {
  joinedAt: null,
  isActive: true,
  deactivationDay: null,
};

const crianca = (
  id: string,
  overrides: Partial<ExpectedChild> = {},
): ExpectedChild => ({
  id,
  clubId: 'club-1',
  clubWeekday: 'saturday',
  ...ativa,
  ...overrides,
});

const janela = (overrides: Partial<ExpectedWindow> = {}): ExpectedWindow => ({
  today: '2026-11-11',
  exceptions: [],
  ...overrides,
});

describe('datas em texto', () => {
  it('soma dias atravessando mês e ano, sem deslocar por fuso', () => {
    expect(addDaysToDateOnly('2026-03-02', 5)).toBe('2026-03-07');
    expect(addDaysToDateOnly('2026-02-27', 3)).toBe('2026-03-02');
    expect(addDaysToDateOnly('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDaysToDateOnly('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('a segunda-feira da semana, com o domingo no fim dela', () => {
    expect(mondayOf('2026-03-02')).toBe('2026-03-02');
    expect(mondayOf('2026-03-04')).toBe('2026-03-02');
    // Domingo 08/03 pertence à semana que começou em 02/03, não em 09/03.
    expect(mondayOf('2026-03-08')).toBe('2026-03-02');
  });
});

describe('wasEnrolledAt', () => {
  it('criança ativa sem data de entrada sempre esteve matriculada', () => {
    expect(wasEnrolledAt(ativa, '2020-01-01')).toBe(true);
  });

  it('não estava matriculada antes de entrar; no dia da entrada já estava', () => {
    const entrouEmAgosto = { ...ativa, joinedAt: '2026-08-10' };

    expect(wasEnrolledAt(entrouEmAgosto, '2026-08-09')).toBe(false);
    expect(wasEnrolledAt(entrouEmAgosto, '2026-08-10')).toBe(true);
    expect(wasEnrolledAt(entrouEmAgosto, '2026-08-11')).toBe(true);
  });

  it('desativada em novembro continua contando de março a outubro', () => {
    // É a regra que impede o histórico de sumir: o `isActive` de hoje é
    // falso, mas em outubro a criança frequentava.
    const saiuEmNovembro: EnrollmentRecord = {
      joinedAt: '2026-03-01',
      isActive: false,
      deactivationDay: '2026-11-05',
    };

    expect(wasEnrolledAt(saiuEmNovembro, '2026-03-07')).toBe(true);
    expect(wasEnrolledAt(saiuEmNovembro, '2026-10-31')).toBe(true);
    // No próprio dia da desativação ainda conta; no seguinte, não.
    expect(wasEnrolledAt(saiuEmNovembro, '2026-11-05')).toBe(true);
    expect(wasEnrolledAt(saiuEmNovembro, '2026-11-06')).toBe(false);
  });

  it('inativa sem dia de desativação conhecido não conta em data nenhuma', () => {
    const semDia = { joinedAt: null, isActive: false, deactivationDay: null };

    expect(wasEnrolledAt(semDia, '2026-03-07')).toBe(false);
  });

  it('countEnrolledAt conta só quem estava matriculada na data', () => {
    const criancas: EnrollmentRecord[] = [
      ativa,
      { ...ativa, joinedAt: '2026-09-01' },
      { joinedAt: null, isActive: false, deactivationDay: '2026-06-30' },
    ];

    expect(countEnrolledAt(criancas, '2026-05-02')).toBe(2);
    expect(countEnrolledAt(criancas, '2026-08-01')).toBe(1);
    expect(countEnrolledAt(criancas, '2026-10-03')).toBe(2);
  });
});

describe('listAcademicWeeks', () => {
  it('lista da semana 1 à última, com a segunda-feira de cada uma', () => {
    const semanas = listAcademicWeeks(PERIODO);

    expect(semanas).toHaveLength(42);
    expect(semanas[0]).toEqual({
      year: 2026,
      week: 1,
      weekStart: '2026-03-02',
      periodStart: '2026-03-02',
      periodEnd: '2026-12-19',
    });
    expect(semanas[41]).toMatchObject({ week: 42, weekStart: '2026-12-14' });
  });

  it('período que abre na quarta tem a semana 1 começando na segunda anterior', () => {
    const semanas = listAcademicWeeks({
      year: 2026,
      startDate: '2026-03-04',
      endDate: '2026-03-15',
    });

    expect(semanas.map((s) => s.weekStart)).toEqual([
      '2026-03-02',
      '2026-03-09',
    ]);
  });
});

describe('clubDayInWeek', () => {
  it('devolve o dia da semana do clubinho, sem escorregar um dia', () => {
    // Regressão do fuso: com `new Date('2026-03-02')` a segunda virava
    // domingo no Brasil e o sábado do clubinho saía na sexta.
    expect(clubDayInWeek('2026-03-02', 'monday')).toBe('2026-03-02');
    expect(clubDayInWeek('2026-03-02', 'saturday')).toBe('2026-03-07');
    expect(clubDayInWeek('2026-03-02', 'sunday')).toBe('2026-03-08');
    expect(clubDayInWeek('2026-03-02', 'SATURDAY')).toBe('2026-03-07');
  });

  it('dia da semana desconhecido não tem dia de clubinho', () => {
    expect(clubDayInWeek('2026-03-02', 'sabado')).toBeNull();
  });
});

describe('isExceptionDay', () => {
  it('reconhece a data exata e a recorrente em outro ano', () => {
    const excecoes = [
      { date: '2026-09-07', isRecurrent: false },
      { date: '2025-12-25', isRecurrent: true },
    ];

    expect(isExceptionDay('2026-09-07', excecoes)).toBe(true);
    expect(isExceptionDay('2026-12-25', excecoes)).toBe(true);
    // Não recorrente só vale no próprio ano.
    expect(isExceptionDay('2027-09-07', excecoes)).toBe(false);
    expect(isExceptionDay('2026-09-08', excecoes)).toBe(false);
  });
});

describe('isClubDayExpected', () => {
  const semana = { periodStart: '2026-03-04', periodEnd: '2026-12-19' };

  it('dia anterior à abertura ou posterior ao fim do período não conta', () => {
    expect(isClubDayExpected('2026-03-02', semana, janela())).toBe(false);
    expect(isClubDayExpected('2026-12-20', semana, janela())).toBe(false);
    expect(isClubDayExpected('2026-03-04', semana, janela())).toBe(true);
  });

  it('dia futuro não conta; hoje conta', () => {
    expect(isClubDayExpected('2026-11-12', semana, janela())).toBe(false);
    expect(isClubDayExpected('2026-11-11', semana, janela())).toBe(true);
  });

  it('respeita o recorte de datas pedido', () => {
    const recorte = janela({ startDate: '2026-05-01', endDate: '2026-05-31' });

    expect(isClubDayExpected('2026-04-30', semana, recorte)).toBe(false);
    expect(isClubDayExpected('2026-05-01', semana, recorte)).toBe(true);
    expect(isClubDayExpected('2026-05-31', semana, recorte)).toBe(true);
    expect(isClubDayExpected('2026-06-01', semana, recorte)).toBe(false);
  });

  it('feriado não conta', () => {
    const comFeriado = janela({
      exceptions: [{ date: '2026-09-07', isRecurrent: false }],
    });

    expect(isClubDayExpected('2026-09-07', semana, comFeriado)).toBe(false);
  });
});

describe('summarizeExpected', () => {
  const semanas: ExpectedWeek[] = listAcademicWeeks(PERIODO);
  const porClubinho = (child: ExpectedChild) => child.clubId;

  it('uma presença esperada por criança por sábado que já passou', () => {
    // De 07/03 a 07/11/2026 são 36 sábados; 14/11 ainda não chegou.
    const esperado = summarizeExpected(
      [crianca('a'), crianca('b')],
      semanas,
      janela(),
      porClubinho,
    );

    expect(esperado.get('club-1')).toEqual({ slots: 72, children: 2 });
  });

  it('quem entrou no meio do ano só é esperada dali em diante', () => {
    // Sábados de maio de 2026: 2, 9, 16, 23 e 30.
    const maio = janela({ startDate: '2026-05-01', endDate: '2026-05-31' });
    const esperado = summarizeExpected(
      [crianca('a'), crianca('nova', { joinedAt: '2026-05-20' })],
      semanas,
      maio,
      (child) => child.id,
    );

    expect(esperado.get('a')?.slots).toBe(5);
    expect(esperado.get('nova')?.slots).toBe(2);
  });

  it('desativada em novembro segue no denominador de maio', () => {
    const maio = janela({ startDate: '2026-05-01', endDate: '2026-05-31' });
    const saiu = crianca('saiu', {
      isActive: false,
      deactivationDay: '2026-11-05',
    });

    const esperado = summarizeExpected([saiu], semanas, maio, porClubinho);

    expect(esperado.get('club-1')).toEqual({ slots: 5, children: 1 });
  });

  it('desativada em maio deixa de ser esperada depois de sair', () => {
    const maio = janela({ startDate: '2026-05-01', endDate: '2026-05-31' });
    const saiu = crianca('saiu', {
      isActive: false,
      deactivationDay: '2026-05-10',
    });

    // Só 02/05 e 09/05.
    expect(
      summarizeExpected([saiu], semanas, maio, porClubinho).get('club-1')
        ?.slots,
    ).toBe(2);
  });

  it('feriado tira o dia do denominador', () => {
    const maio = janela({
      startDate: '2026-05-01',
      endDate: '2026-05-31',
      exceptions: [{ date: '2026-05-16', isRecurrent: false }],
    });

    expect(
      summarizeExpected([crianca('a')], semanas, maio, porClubinho).get(
        'club-1',
      )?.slots,
    ).toBe(4);
  });

  it('cada clubinho usa o próprio dia da semana', () => {
    // Semana de 02/03: o de segunda se reúne dia 2, o de sábado dia 7.
    const ateQuarta = janela({ today: '2026-03-04' });
    const esperado = summarizeExpected(
      [
        crianca('seg', { clubId: 'club-seg', clubWeekday: 'monday' }),
        crianca('sab', { clubId: 'club-sab', clubWeekday: 'saturday' }),
      ],
      semanas,
      ateQuarta,
      porClubinho,
    );

    expect(esperado.get('club-seg')?.slots).toBe(1);
    // O sábado ainda não chegou: nada esperado, e a chave nem aparece.
    expect(esperado.has('club-sab')).toBe(false);
  });

  it('sem período letivo ninguém é esperado', () => {
    expect(
      summarizeExpected([crianca('a')], [], janela(), porClubinho).size,
    ).toBe(0);
  });

  it('agrupa pela semana e ignora chave nula', () => {
    const duasSemanas = semanas.slice(0, 2);
    const esperado = summarizeExpected(
      [crianca('a'), crianca('b')],
      duasSemanas,
      janela(),
      (child, week) => (child.id === 'b' ? null : `${week.year}-${week.week}`),
    );

    expect(Array.from(esperado.keys())).toEqual(['2026-1', '2026-2']);
    expect(esperado.get('2026-1')).toEqual({ slots: 1, children: 1 });
  });
});
