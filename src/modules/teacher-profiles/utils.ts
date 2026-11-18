import { AccessContext } from 'src/core/auth/auth.types';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import { TEACHER_READ_ROLES } from './constants';

/** Quem pode consultar e vincular professores. */
export function canAccessTeacherProfiles(context: AccessContext): boolean {
  return !!context.role && TEACHER_READ_ROLES.includes(context.role);
}

/** Barra quem não pode consultar nem vincular professores. */
export function assertCanAccessTeacherProfiles(context: AccessContext): void {
  if (!canAccessTeacherProfiles(context)) {
    throw new AppForbiddenException(
      ErrorCode.ACCESS_DENIED,
      'Apenas administradores e coordenadores podem gerenciar professores',
    );
  }
}
