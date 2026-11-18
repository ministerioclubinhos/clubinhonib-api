import {
  addDays,
  formatDateOnlyPtBr,
  parseDateOnly,
  toDateOnly,
  todayAsLocalDate,
} from './date.utils';

describe('statistics date utils', () => {
  describe('toDateOnly', () => {
    it('formata a data pelo calendário local', () => {
      expect(toDateOnly(new Date(2026, 8, 1))).toBe('2026-09-01');
    });

    it('preenche mês e dia com zero à esquerda', () => {
      expect(toDateOnly(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('mantém o dia mesmo às vésperas da virada', () => {
      // 23:59 local continua sendo o mesmo dia de calendário.
      expect(toDateOnly(new Date(2026, 8, 1, 23, 59))).toBe('2026-09-01');
    });

    it('não desliza o dia como o formato via UTC fazia', () => {
      // `new Date(ano, mês, dia)` é meia-noite local. Em fuso positivo,
      // `toISOString()` recuaria para o dia anterior; comparar com os
      // componentes locais garante que a janela não escorregue.
      const localMidnight = new Date(2026, 8, 1);
      const viaLocalComponents = toDateOnly(localMidnight);
      const expected = `${localMidnight.getFullYear()}-${String(
        localMidnight.getMonth() + 1,
      ).padStart(2, '0')}-${String(localMidnight.getDate()).padStart(2, '0')}`;

      expect(viaLocalComponents).toBe(expected);
      expect(viaLocalComponents).toBe('2026-09-01');
    });
  });

  describe('parseDateOnly', () => {
    it('lê a data como local, sem deslocar o dia', () => {
      const date = parseDateOnly('2026-09-01');

      expect(date.getFullYear()).toBe(2026);
      expect(date.getMonth()).toBe(8);
      expect(date.getDate()).toBe(1);
      expect(date.getHours()).toBe(0);
    });

    it('faz o caminho de volta de toDateOnly', () => {
      expect(toDateOnly(parseDateOnly('2026-02-28'))).toBe('2026-02-28');
    });
  });

  describe('addDays', () => {
    it('soma dias dentro do mesmo mês', () => {
      expect(toDateOnly(addDays(parseDateOnly('2026-09-01'), 6))).toBe(
        '2026-09-07',
      );
    });

    it('atravessa a virada de mês', () => {
      expect(toDateOnly(addDays(parseDateOnly('2026-08-30'), 3))).toBe(
        '2026-09-02',
      );
    });

    it('atravessa a virada de ano', () => {
      expect(toDateOnly(addDays(parseDateOnly('2026-12-30'), 3))).toBe(
        '2027-01-02',
      );
    });

    it('aceita deslocamento negativo', () => {
      expect(toDateOnly(addDays(parseDateOnly('2026-09-01'), -1))).toBe(
        '2026-08-31',
      );
    });

    it('respeita ano bissexto', () => {
      expect(toDateOnly(addDays(parseDateOnly('2028-02-28'), 1))).toBe(
        '2028-02-29',
      );
    });
  });

  describe('todayAsLocalDate', () => {
    it('zera o horário', () => {
      const today = todayAsLocalDate();

      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
      expect(today.getSeconds()).toBe(0);
    });

    it('corresponde ao dia de calendário corrente', () => {
      const now = new Date();

      expect(toDateOnly(todayAsLocalDate())).toBe(toDateOnly(now));
    });
  });

  describe('formatDateOnlyPtBr', () => {
    it('reordena o texto sem passar por fuso', () => {
      // `new Date('2026-03-02').toLocaleDateString('pt-BR')` dava 01/03 no
      // Brasil.
      expect(formatDateOnlyPtBr('2026-03-02')).toBe('02/03/2026');
      expect(formatDateOnlyPtBr('2026-12-19')).toBe('19/12/2026');
    });
  });
});
