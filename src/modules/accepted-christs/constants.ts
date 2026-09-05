import { UserRole } from 'src/core/auth/auth.types';

/**
 * Quem registra uma decisão.
 *
 * O professor é quem está com a criança no clubinho, então é ele quem registra
 * — dentro do próprio clubinho, recorte que o módulo de crianças aplica. A rota
 * não tinha guard nenhum: qualquer pessoa na internet gravava o registro.
 */
export const ACCEPTED_CHRIST_WRITE_ROLES: readonly UserRole[] = [
  UserRole.ADMIN,
  UserRole.COORDINATOR,
  UserRole.TEACHER,
];

/** Tamanho máximo da observação, igual ao da coluna. */
export const ACCEPTED_CHRIST_NOTES_MAX_LENGTH = 500;

/**
 * A decisão em texto legível.
 *
 * O enum é maiúsculo e técnico; o e-mail que chega ao clubinho não é.
 */
export const DECISION_LABELS = {
  ACCEPTED: 'Aceitou a Jesus',
  RECONCILED: 'Reconciliou-se com Jesus',
} as const;

/** O que dizer quando a decisão não foi especificada no registro. */
export const DECISION_UNSPECIFIED_LABEL = 'Decisão registrada';

/** Tela do painel para onde o aviso da decisão aponta. */
export const ACCEPTED_CHRIST_PANEL_PATH = 'adm/decisoes';
