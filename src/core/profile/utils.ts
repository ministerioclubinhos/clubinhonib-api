import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import { PROFILE_LIST_ROLES } from './constants';
import { ProfileAccessContext } from './types';

/** Papel em minúsculas, que é como as regras comparam. */
export function normalizedRole(context: ProfileAccessContext): string {
  return context.role?.toLowerCase() ?? '';
}

/** Só administrador e coordenador enxergam a lista de perfis alheios. */
export function canListProfiles(context: ProfileAccessContext): boolean {
  return (PROFILE_LIST_ROLES as readonly string[]).includes(
    normalizedRole(context),
  );
}

/** Barra quem não pode listar perfis. */
export function assertCanListProfiles(context: ProfileAccessContext): void {
  if (!canListProfiles(context)) {
    throw new AppForbiddenException(
      ErrorCode.ACCESS_DENIED,
      'Apenas administradores e coordenadores podem listar perfis',
    );
  }
}

/** Só administrador mexe no perfil de outra pessoa. */
export function assertCanManageOtherProfiles(
  context: ProfileAccessContext,
): void {
  if (normalizedRole(context) !== 'admin') {
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
