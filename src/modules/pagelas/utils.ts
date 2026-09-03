import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import {
  PAGELA_MAX_WEEK,
  PAGELA_MAX_YEAR,
  PAGELA_MIN_WEEK,
  PAGELA_MIN_YEAR,
  PAGELA_ROLES,
  PAGELA_UNRESTRICTED_ROLE,
} from './constants';
import { AcademicWeek } from './types';
import { PagelaAccessContext } from './types';

export {
  getAcademicWeek,
  getISOWeek,
  referenceYearOf,
} from 'src/shared/academic-week/academic-week.util';

/** Papel em minúsculas, que é como as regras comparam. */
export function normalizedRole(context: PagelaAccessContext): string {
  return context.role?.toLowerCase() ?? '';
}

/** Só administrador, coordenador e professor trabalham com pagelas. */
export function canAccessPagelas(context: PagelaAccessContext): boolean {
  return (PAGELA_ROLES as readonly string[]).includes(normalizedRole(context));
}

/** Administrador enxerga todos os clubinhos; os demais, só os seus. */
export function hasUnrestrictedScope(context: PagelaAccessContext): boolean {
  return normalizedRole(context) === PAGELA_UNRESTRICTED_ROLE;
}

/** Barra quem não tem nada que ver com pagelas. */
export function assertCanAccessPagelas(context: PagelaAccessContext): void {
  if (!canAccessPagelas(context)) {
    throw new AppForbiddenException(ErrorCode.ACCESS_DENIED, 'Acesso negado');
  }
}

function isYear(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= PAGELA_MIN_YEAR &&
    value <= PAGELA_MAX_YEAR
  );
}

function isWeek(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= PAGELA_MIN_WEEK &&
    value <= PAGELA_MAX_WEEK
  );
}

/**
 * Lê a busca livre da listagem.
 *
 * Aceita `2026-48`, só o ano (`2026`) ou só a semana (`48`). O que não se
 * encaixa é ignorado, e a busca simplesmente não filtra por aquilo.
 */
export function parseWeekSearch(searchString?: string): Partial<AcademicWeek> {
  const raw = searchString?.trim();
  if (!raw) return {};

  const parts = raw.split('-');

  if (parts.length === 2) {
    const year = Number(parts[0]);
    const week = Number(parts[1]);
    return {
      ...(isYear(year) ? { year } : {}),
      ...(isWeek(week) ? { week } : {}),
    };
  }

  const value = Number(raw);
  if (isYear(value)) return { year: value };
  if (isWeek(value)) return { week: value };

  return {};
}
