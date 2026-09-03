import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { CLUB_DISTRICT_FALLBACK, CLUB_MANAGER_ROLES } from './constants';
import { ClubAccessContext } from './types';

/** Papel em minúsculas, que é como as regras comparam. */
export function normalizedRole(context: ClubAccessContext): string {
  return context.role?.toLowerCase() ?? '';
}

/** Só administrador e coordenador administram clubinhos. */
export function canManageClubs(context: ClubAccessContext): boolean {
  return (CLUB_MANAGER_ROLES as readonly string[]).includes(
    normalizedRole(context),
  );
}

/**
 * Barra quem não pode administrar clubinhos.
 *
 * A regra estava repetida em cada caso de uso, com mensagens diferentes; aqui
 * ela existe uma vez só.
 */
export function assertCanManageClubs(context: ClubAccessContext): void {
  if (!canManageClubs(context)) {
    throw new AppForbiddenException(
      ErrorCode.CLUB_ACCESS_DENIED,
      'Acesso negado',
    );
  }
}

/** Horário em `HH:mm`, ou `null` quando não há. */
export function toDisplayTime(value?: string | null): string | null {
  return typeof value === 'string' ? value.slice(0, 5) : null;
}

/** Rótulo do clubinho nos seletores: `Clubinho 12 : Centro`. */
export function formatClubOptionLabel(
  number: number,
  district?: string | null,
): string {
  return `Clubinho ${number} : ${district?.trim() || CLUB_DISTRICT_FALLBACK}`;
}
