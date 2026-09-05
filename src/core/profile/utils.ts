import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import { PROFILE_LIST_ROLES } from './constants';
import { ProfileAccessContext } from './types';
import { UserRole } from 'src/core/auth/auth.types';
import { normalizeRole } from 'src/core/auth/role.utils';

/** O papel de quem chamou, ou `undefined` quando não é um papel conhecido. */
export function normalizedRole(
  context: ProfileAccessContext,
): UserRole | undefined {
  return normalizeRole(context.role);
}

/** Só administrador e coordenador enxergam a lista de perfis alheios. */
export function canListProfiles(context: ProfileAccessContext): boolean {
  const role = normalizedRole(context);

  return (
    role !== undefined &&
    (PROFILE_LIST_ROLES as readonly UserRole[]).includes(role)
  );
}

/**
 * Barra quem não pode listar perfis e devolve o papel de quem passou.
 *
 * Devolver em vez de só barrar poupa o chamador de normalizar o papel de novo —
 * e, principalmente, de afirmar com um `as UserRole` o que esta função acabou
 * de garantir.
 */
export function assertCanListProfiles(context: ProfileAccessContext): UserRole {
  const role = normalizedRole(context);

  if (
    role === undefined ||
    !(PROFILE_LIST_ROLES as readonly UserRole[]).includes(role)
  ) {
    throw new AppForbiddenException(
      ErrorCode.ACCESS_DENIED,
      'Apenas administradores e coordenadores podem listar perfis',
    );
  }

  return role;
}

/** Só administrador mexe no perfil de outra pessoa. */
export function assertCanManageOtherProfiles(
  context: ProfileAccessContext,
): void {
  if (normalizedRole(context) !== UserRole.ADMIN) {
    throw new AppForbiddenException(
      ErrorCode.ACCESS_DENIED,
      'Apenas administradores podem alterar o perfil de outra pessoa',
    );
  }
}

/**
 * Data de nascimento em `YYYY-MM-DD`.
 *
 * A coluna é de data pura e pode voltar como `Date` ou como texto, conforme o
 * driver. Cortar no `T` mantém o dia do calendário sem passar por fuso.
 */
export function toDateOnly(value?: Date | string | null): string | undefined {
  if (!value) return undefined;

  const raw = value instanceof Date ? value.toISOString() : String(value);
  return raw.split('T')[0];
}
