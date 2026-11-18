import { UserRole } from 'src/core/auth/auth.types';
import { AppForbiddenException } from 'src/shared/exceptions';

import {
  assertCanManageCoordinatorProfiles,
  assertCanReadCoordinatorProfiles,
  canReadCoordinatorProfiles,
} from './utils';

/**
 * Antes nenhuma rota de `/coordinator-profiles` verificava o papel: qualquer
 * pessoa autenticada — inclusive um professor — listava e-mail e telefone de
 * todos os coordenadores e professores, e movia clubinhos entre eles.
 */
describe('acesso aos coordenadores', () => {
  describe('leitura', () => {
    it.each([UserRole.ADMIN, UserRole.COORDINATOR])('libera %s', (role) => {
      expect(canReadCoordinatorProfiles({ role, userId: 'u1' })).toBe(true);
      expect(() =>
        assertCanReadCoordinatorProfiles({ role, userId: 'u1' }),
      ).not.toThrow();
    });

    it('barra o professor', () => {
      expect(() =>
        assertCanReadCoordinatorProfiles({
          role: UserRole.TEACHER,
          userId: 'u1',
        }),
      ).toThrow(AppForbiddenException);
    });

    it('barra quem chega sem papel', () => {
      expect(canReadCoordinatorProfiles({ userId: null })).toBe(false);
      expect(() => assertCanReadCoordinatorProfiles({ userId: null })).toThrow(
        AppForbiddenException,
      );
    });
  });

  describe('escrita', () => {
    it('libera o administrador', () => {
      expect(() =>
        assertCanManageCoordinatorProfiles({
          role: UserRole.ADMIN,
          userId: 'u1',
        }),
      ).not.toThrow();
    });

    it.each([UserRole.COORDINATOR, UserRole.TEACHER])('barra %s', (role) => {
      expect(() =>
        assertCanManageCoordinatorProfiles({ role, userId: 'u1' }),
      ).toThrow(AppForbiddenException);
    });
  });
});
