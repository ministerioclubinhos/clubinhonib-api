import { AccessContext } from 'src/core/auth/auth.types';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import { COORDINATOR_MANAGE_ROLES, COORDINATOR_READ_ROLES } from './constants';

/** Quem pode ler a listagem e o detalhe dos coordenadores. */
export function canReadCoordinatorProfiles(context: AccessContext): boolean {
  return !!context.role && COORDINATOR_READ_ROLES.includes(context.role);
}

/** Barra quem não pode ler os coordenadores. */
export function assertCanReadCoordinatorProfiles(context: AccessContext): void {
  if (!canReadCoordinatorProfiles(context)) {
    throw new AppForbiddenException(
      ErrorCode.ACCESS_DENIED,
      'Apenas administradores e coordenadores podem consultar coordenadores',
    );
  }
}

/** Barra quem não pode alterar o vínculo entre clubinho e coordenador. */
export function assertCanManageCoordinatorProfiles(
  context: AccessContext,
): void {
  if (!context.role || !COORDINATOR_MANAGE_ROLES.includes(context.role)) {
    throw new AppForbiddenException(
      ErrorCode.ACCESS_DENIED,
      'Apenas administradores podem alterar os clubinhos de um coordenador',
    );
  }
}
