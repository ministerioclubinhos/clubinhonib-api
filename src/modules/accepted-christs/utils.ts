import { AccessContext } from 'src/core/auth/auth.types';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import {
  ACCEPTED_CHRIST_WRITE_ROLES,
  DECISION_RULE_MESSAGES,
  PRIOR_ACCEPTANCE_DECISIONS,
  DECISION_LABELS,
  DECISION_UNSPECIFIED_LABEL,
} from './constants';
import { DecisionType } from './enums/decision-type.enum';

/** Quem pode registrar uma decisão. */
export function canRegisterDecision(context: AccessContext): boolean {
  return !!context.role && ACCEPTED_CHRIST_WRITE_ROLES.includes(context.role);
}

/** Barra quem não pode registrar uma decisão. */
export function assertCanRegisterDecision(context: AccessContext): void {
  if (!canRegisterDecision(context)) {
    throw new AppForbiddenException(
      ErrorCode.ACCESS_DENIED,
      'Seu perfil não registra decisões',
    );
  }
}

/**
 * A decisão em texto legível para o corpo do e-mail.
 *
 * `null` é um estado normal — a coluna é anulável, e quem registra nem sempre
 * marca qual foi a decisão —, então há um rótulo para ele em vez de um vazio.
 */
export function decisionLabel(decision: DecisionType | null): string {
  if (!decision) return DECISION_UNSPECIFIED_LABEL;
  return DECISION_LABELS[decision] ?? DECISION_UNSPECIFIED_LABEL;
}

/** A criança já tem uma decisão que conta como aceitação? */
export function hasPriorAcceptance(
  decisions: readonly (DecisionType | null)[],
): boolean {
  return decisions.some(
    (decision) =>
      decision !== null && PRIOR_ACCEPTANCE_DECISIONS.includes(decision),
  );
}

/**
 * Por que a decisão não pode ser registrada, ou `null` quando pode.
 *
 * Aceitar é uma vez só; reconciliar pressupõe ter aceitado — e pode se repetir.
 * Criança desativada não recebe decisão: ela saiu do clubinho.
 */
export function decisionRefusal(input: {
  decision: DecisionType;
  childIsActive: boolean;
  existing: readonly (DecisionType | null)[];
}): string | null {
  if (!input.childIsActive) return DECISION_RULE_MESSAGES.CHILD_INACTIVE;

  const accepted = hasPriorAcceptance(input.existing);
  if (input.decision === DecisionType.ACCEPTED && accepted) {
    return DECISION_RULE_MESSAGES.ALREADY_ACCEPTED;
  }
  if (input.decision === DecisionType.RECONCILED && !accepted) {
    return DECISION_RULE_MESSAGES.RECONCILED_WITHOUT_ACCEPTANCE;
  }

  return null;
}

/**
 * Por que a decisão não pode ser excluída, ou `null` quando pode.
 *
 * Tirar a aceitação deixando reconciliações para trás criaria justamente o
 * estado que o registro proíbe: reconciliada sem nunca ter aceitado.
 */
export function decisionRemovalRefusal(input: {
  decision: DecisionType | null;
  others: readonly (DecisionType | null)[];
}): string | null {
  if (input.decision !== DecisionType.ACCEPTED) return null;

  const stillAccepted = input.others.includes(DecisionType.ACCEPTED);
  const hasReconciliations = input.others.includes(DecisionType.RECONCILED);

  return hasReconciliations && !stillAccepted
    ? DECISION_RULE_MESSAGES.ACCEPTANCE_HAS_RECONCILIATIONS
    : null;
}
