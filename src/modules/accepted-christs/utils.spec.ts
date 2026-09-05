import { UserRole } from 'src/core/auth/auth.types';
import { AppForbiddenException } from 'src/shared/exceptions';

import { assertCanRegisterDecision, canRegisterDecision } from './utils';

/**
 * A rota não tinha guard nenhum: qualquer pessoa na internet gravava que uma
 * criança aceitou a Jesus. Estes casos travam quem pode registrar.
 */
describe('acesso ao registro de decisão', () => {
  it.each([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.TEACHER])(
    'libera %s',
    (role) => {
      expect(canRegisterDecision({ role, userId: 'u1' })).toBe(true);
      expect(() =>
        assertCanRegisterDecision({ role, userId: 'u1' }),
      ).not.toThrow();
    },
  );

  it('barra quem chega sem papel', () => {
    expect(canRegisterDecision({ userId: null })).toBe(false);
    expect(() => assertCanRegisterDecision({ userId: null })).toThrow(
      AppForbiddenException,
    );
  });

  it('barra papel desconhecido', () => {
    const context = { role: 'visitante' as UserRole, userId: 'u1' };

    expect(canRegisterDecision(context)).toBe(false);
    expect(() => assertCanRegisterDecision(context)).toThrow(
      AppForbiddenException,
    );
  });
});
