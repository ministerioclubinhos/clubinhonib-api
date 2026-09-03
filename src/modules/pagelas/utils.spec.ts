import { AppForbiddenException } from 'src/shared/exceptions';

import {
  assertCanAccessPagelas,
  canAccessPagelas,
  getAcademicWeek,
  hasUnrestrictedScope,
  parseWeekSearch,
} from './utils';

describe('pagelas utils', () => {
  describe('papéis', () => {
    it('administrador, coordenador e professor trabalham com pagelas', () => {
      expect(canAccessPagelas({ role: 'admin' })).toBe(true);
      expect(canAccessPagelas({ role: 'coordinator' })).toBe(true);
      expect(canAccessPagelas({ role: 'teacher' })).toBe(true);
    });

    it('qualquer outro papel é barrado', () => {
      expect(canAccessPagelas({ role: 'user' })).toBe(false);
      expect(canAccessPagelas({})).toBe(false);
      expect(() => assertCanAccessPagelas({})).toThrow(AppForbiddenException);
    });

    it('só o administrador enxerga além do próprio alcance', () => {
      expect(hasUnrestrictedScope({ role: 'ADMIN' })).toBe(true);
      expect(hasUnrestrictedScope({ role: 'coordinator' })).toBe(false);
      expect(hasUnrestrictedScope({ role: 'teacher' })).toBe(false);
    });
  });

  describe('semana letiva', () => {
    const period = {
      year: 2026,
      startDate: '2026-02-02',
      endDate: '2026-12-12',
    };

    it('conta a partir da semana em que o período começa', () => {
      expect(getAcademicWeek('2026-02-02', period)).toEqual({
        year: 2026,
        week: 1,
      });
      expect(getAcademicWeek('2026-02-08', period)).toEqual({
        year: 2026,
        week: 1,
      });
      expect(getAcademicWeek('2026-02-09', period)).toEqual({
        year: 2026,
        week: 2,
      });
    });

    it('devolve nulo fora do período, em vez de estourar', () => {
      expect(getAcademicWeek('2026-01-31', period)).toBeNull();
      expect(getAcademicWeek('2026-12-13', period)).toBeNull();
    });

    it('não escorrega um dia por causa do fuso', () => {
      // `new Date('2026-02-02')` seria meia-noite UTC e, em Manaus, cairia no
      // dia 1 — que está fora do período.
      expect(getAcademicWeek('2026-02-02', period)).not.toBeNull();
    });
  });

  describe('busca livre por semana e ano', () => {
    it('entende ano-semana', () => {
      expect(parseWeekSearch('2026-48')).toEqual({ year: 2026, week: 48 });
    });

    it('entende só o ano ou só a semana', () => {
      expect(parseWeekSearch('2026')).toEqual({ year: 2026 });
      expect(parseWeekSearch('48')).toEqual({ week: 48 });
    });

    it('ignora o que não é semana nem ano', () => {
      expect(parseWeekSearch('abc')).toEqual({});
      expect(parseWeekSearch('99')).toEqual({});
      expect(parseWeekSearch('  ')).toEqual({});
      expect(parseWeekSearch(undefined)).toEqual({});
    });
  });
});
