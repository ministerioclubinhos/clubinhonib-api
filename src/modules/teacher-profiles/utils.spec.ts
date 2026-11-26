import { UserRole } from 'src/core/auth/auth.types';
import { AppForbiddenException } from 'src/shared/exceptions';

import {
  assertCanAccessTeacherProfiles,
  canAccessTeacherProfiles,
} from './utils';

/**
 * A listagem de professores traz e-mail e telefone dos colegas e do
 * coordenador de cada clubinho, então o professor não a enxerga.
 */
describe('acesso aos professores', () => {
  it.each([UserRole.ADMIN, UserRole.COORDINATOR])('libera %s', (role) => {
    expect(canAccessTeacherProfiles({ role, userId: 'u1' })).toBe(true);
    expect(() =>
      assertCanAccessTeacherProfiles({ role, userId: 'u1' }),
    ).not.toThrow();
  });

  it('barra o professor', () => {
    expect(
      canAccessTeacherProfiles({ role: UserRole.TEACHER, userId: 'u1' }),
    ).toBe(false);
    expect(() =>
      assertCanAccessTeacherProfiles({ role: UserRole.TEACHER, userId: 'u1' }),
    ).toThrow(AppForbiddenException);
  });

  it('barra quem chega sem papel', () => {
    expect(() => assertCanAccessTeacherProfiles({ userId: null })).toThrow(
      AppForbiddenException,
    );
  });
});
