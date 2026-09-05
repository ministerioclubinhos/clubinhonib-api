import { AccessContext } from 'src/core/auth/auth.types';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';

import {
  ACCEPTED_CHRIST_WRITE_ROLES,
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
