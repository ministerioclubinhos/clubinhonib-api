import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { CLUB_DISTRICT_FALLBACK, CLUB_MANAGER_ROLES } from './constants';
import { UserRole } from 'src/core/auth/auth.types';
import { normalizeRole } from 'src/core/auth/role.utils';
import { ClubAccessContext } from './types';

/** O papel de quem chamou, ou `undefined` quando não é um papel conhecido. */
export function normalizedRole(
  context: ClubAccessContext,
): UserRole | undefined {
  return normalizeRole(context.role);
}

/** Só administrador e coordenador administram clubinhos. */
export function canManageClubs(context: ClubAccessContext): boolean {
  const role = normalizedRole(context);

  return (
    role !== undefined &&
    (CLUB_MANAGER_ROLES as readonly UserRole[]).includes(role)
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

/**
 * Só administrador exclui um clubinho.
 *
 * É a única operação de clubinho fechada para a coordenação, e a razão é ser a
 * única irreversível: o coordenador muda dia, horário, endereço e equipe, e
 * pode **desativar** o clubinho — que tira o encontro do calendário e preserva
 * o histórico, com volta. A exclusão apaga a linha e desvincula as crianças.
 *
 * O erro é o de acesso negado, e não "não encontrado": esconder a existência do
 * clubinho não faria sentido para quem o coordena e o vê na própria listagem.
 */
export function assertCanDeleteClub(context: ClubAccessContext): void {
  if (normalizedRole(context) === UserRole.ADMIN) return;

  throw new AppForbiddenException(
    ErrorCode.CLUB_ACCESS_DENIED,
    'Apenas um administrador pode excluir um clubinho. ' +
      'Para tirá-lo do ar preservando o histórico, desative-o.',
  );
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
