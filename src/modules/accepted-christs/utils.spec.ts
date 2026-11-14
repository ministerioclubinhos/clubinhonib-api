import { UserRole } from 'src/core/auth/auth.types';
import { AppForbiddenException } from 'src/shared/exceptions';

import { DECISION_RULE_MESSAGES } from './constants';
import { DecisionType } from './enums/decision-type.enum';
import {
  assertCanRegisterDecision,
  canRegisterDecision,
  decisionRefusal,
  decisionRemovalRefusal,
} from './utils';

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

describe('regras de decisão', () => {
  const base = { childIsActive: true, existing: [] };

  it('a primeira aceitação passa', () => {
    expect(
      decisionRefusal({ ...base, decision: DecisionType.ACCEPTED }),
    ).toBeNull();
  });

  it('registro antigo sem tipo não conta como aceitação', () => {
    expect(
      decisionRefusal({
        childIsActive: true,
        existing: [null],
        decision: DecisionType.RECONCILED,
      }),
    ).toBe(DECISION_RULE_MESSAGES.RECONCILED_WITHOUT_ACCEPTANCE);
  });

  it('criança desativada não recebe decisão alguma', () => {
    expect(
      decisionRefusal({
        childIsActive: false,
        existing: [DecisionType.ACCEPTED],
        decision: DecisionType.RECONCILED,
      }),
    ).toBe(DECISION_RULE_MESSAGES.CHILD_INACTIVE);
  });

  it('a aceitação só sai depois das reconciliações', () => {
    expect(
      decisionRemovalRefusal({
        decision: DecisionType.ACCEPTED,
        others: [DecisionType.RECONCILED],
      }),
    ).toBe(DECISION_RULE_MESSAGES.ACCEPTANCE_HAS_RECONCILIATIONS);
    expect(
      decisionRemovalRefusal({ decision: DecisionType.ACCEPTED, others: [] }),
    ).toBeNull();
  });
});
