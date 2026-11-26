import { Weekday } from 'src/modules/clubs/entities/weekday.enum';
import {
  ExceptionCalendar,
  PeriodWindow,
  RecurrenceSource,
  expandOccurrences,
  toDateKey,
  todayKey,
} from './occurrences.util';

/** Período letivo de março a abril de 2026, com cinco sábados. */
const period2026: PeriodWindow = {
  startDate: '2026-03-07',
  endDate: '2026-04-04',
};

const meeting = (
  overrides: Partial<RecurrenceSource> = {},
): RecurrenceSource => ({
  date: '2026-01-03',
  isRecurring: true,
  weekday: Weekday.SATURDAY,
  ...overrides,
});

const noExceptions = new ExceptionCalendar([]);

describe('expandOccurrences', () => {
  describe('evento comum', () => {
    it('acontece uma vez, no dia marcado', () => {
      const event = meeting({ isRecurring: false, weekday: null });

      expect(expandOccurrences(event, [], noExceptions)).toEqual([
        '2026-01-03',
      ]);
    });

    it('não responde ao período letivo', () => {
      // Um evento marcado à mão vale para o dia escolhido. Recesso escolar não
      // cancela a reunião de pais que alguém cadastrou para janeiro.
      const event = meeting({ isRecurring: false, weekday: null });

      expect(expandOccurrences(event, [period2026], noExceptions)).toEqual([
        '2026-01-03',
      ]);
    });

    it('fica de fora quando a data não cai no recorte pedido', () => {
      const event = meeting({ isRecurring: false, weekday: null });

      expect(
        expandOccurrences(event, [], noExceptions, { from: '2026-02-01' }),
      ).toEqual([]);
    });
  });

  describe('encontro de clubinho', () => {
    it('não acontece nenhuma vez sem período letivo cadastrado', () => {
      // A regra do admin: sem período letivo para o ano, não existe dia de
      // clubinho, mesmo com o clubinho ativo e com dia da semana definido.
      expect(expandOccurrences(meeting(), [], noExceptions)).toEqual([]);
    });

    it('repete todo sábado dentro do período letivo', () => {
      expect(expandOccurrences(meeting(), [period2026], noExceptions)).toEqual([
        '2026-03-07',
        '2026-03-14',
        '2026-03-21',
        '2026-03-28',
        '2026-04-04',
      ]);
    });

    it('não passa do fim do período letivo', () => {
      const dates = expandOccurrences(meeting(), [period2026], noExceptions);

      expect(dates.at(-1)).toBe('2026-04-04');
    });

    it('começa no primeiro sábado do período, não antes', () => {
      // A série existe desde janeiro, mas o período só abre em março.
      const dates = expandOccurrences(meeting(), [period2026], noExceptions);

      expect(dates[0]).toBe('2026-03-07');
    });

    it('começa na série quando ela nasce depois do período abrir', () => {
      // Clubinho cadastrado no meio do ano letivo: a agenda dele começa a
      // partir de quando ele passou a existir.
      const dates = expandOccurrences(
        meeting({ date: '2026-03-20' }),
        [period2026],
        noExceptions,
      );

      expect(dates).toEqual(['2026-03-21', '2026-03-28', '2026-04-04']);
    });

    it('pula o dia de exceção', () => {
      const exceptions = new ExceptionCalendar([
        { exceptionDate: '2026-03-21', isRecurrent: false },
      ]);

      expect(expandOccurrences(meeting(), [period2026], exceptions)).toEqual([
        '2026-03-07',
        '2026-03-14',
        '2026-03-28',
        '2026-04-04',
      ]);
    });

    it('ignora exceção que cai fora do dia do clubinho', () => {
      // A exceção é por data. Uma quarta-feira sem Clubinho não tira nada de um
      // clubinho de sábado.
      const exceptions = new ExceptionCalendar([
        { exceptionDate: '2026-03-18', isRecurrent: false },
      ]);

      expect(
        expandOccurrences(meeting(), [period2026], exceptions),
      ).toHaveLength(5);
    });

    it('ignora exceção fora do período letivo', () => {
      const exceptions = new ExceptionCalendar([
        { exceptionDate: '2026-01-03', isRecurrent: false },
      ]);

      expect(
        expandOccurrences(meeting(), [period2026], exceptions),
      ).toHaveLength(5);
    });

    it('aplica exceção recorrente no mesmo dia e mês de outro ano', () => {
      // `isRecurrent` nasce ligado no cadastro, porque a maioria é feriado.
      const exceptions = new ExceptionCalendar([
        { exceptionDate: '2025-03-21', isRecurrent: true },
      ]);

      const dates = expandOccurrences(meeting(), [period2026], exceptions);

      expect(dates).not.toContain('2026-03-21');
      expect(dates).toHaveLength(4);
    });

    it('exceção não recorrente vale só para o ano dela', () => {
      const exceptions = new ExceptionCalendar([
        { exceptionDate: '2025-03-21', isRecurrent: false },
      ]);

      expect(expandOccurrences(meeting(), [period2026], exceptions)).toContain(
        '2026-03-21',
      );
    });

    it('percorre um período por ano, em ordem', () => {
      const periods: PeriodWindow[] = [
        { startDate: '2027-03-06', endDate: '2027-03-13' },
        { startDate: '2026-03-28', endDate: '2026-04-04' },
      ];

      expect(expandOccurrences(meeting(), periods, noExceptions)).toEqual([
        '2026-03-28',
        '2026-04-04',
        '2027-03-06',
        '2027-03-13',
      ]);
    });

    it('respeita o recorte de datas pedido por quem consulta', () => {
      const dates = expandOccurrences(meeting(), [period2026], noExceptions, {
        from: '2026-03-15',
        to: '2026-03-29',
      });

      expect(dates).toEqual(['2026-03-21', '2026-03-28']);
    });
  });
});

describe('toDateKey', () => {
  it('corta a hora de uma data em ISO completo', () => {
    expect(toDateKey('2026-03-07T00:00:00.000Z')).toBe('2026-03-07');
  });

  it('lê um `Date` pelas partes locais', () => {
    // O driver pode devolver `Date` para coluna `date`. `toISOString` levaria o
    // dia para UTC e, em fuso negativo, voltaria o dia anterior.
    expect(toDateKey(new Date(2026, 2, 7))).toBe('2026-03-07');
  });
});

describe('fuso do calendário', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('lê o dia no fuso do Clubinho, não no do processo', () => {
    // 23h30 de sábado em São Paulo já é domingo em UTC. Um contêiner em UTC
    // tirava o encontro de sábado da agenda três horas antes da hora.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-20T02:30:00Z'));

    expect(todayKey()).toBe('2026-09-19');
  });

  it('vira o dia à meia-noite de São Paulo', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-20T03:00:00Z'));

    expect(todayKey()).toBe('2026-09-20');
  });
});

describe('clubinho desativado', () => {
  it('não sobra data nenhuma, porque a linha inteira é apagada', () => {
    // A desativação não deixa uma recorrência "encerrada" para trás: ela apaga
    // a definição. Sem linha, não há o que expandir — e reativar cria de novo,
    // valendo a partir do dia da reativação.
    expect(
      expandOccurrences(meeting(), [period2026], noExceptions),
    ).toHaveLength(5);
  });
});
