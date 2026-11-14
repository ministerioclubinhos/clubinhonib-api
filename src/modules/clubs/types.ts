import { EmailRecipient } from 'src/shared/email';

import { CLUB_SORT_FIELDS } from './constants';

/**
 * Quem está pedindo a operação.
 *
 * Os casos de uso recebem isto, e não a requisição HTTP: quem lê o token é o
 * controller, que é a camada que enxerga o transporte.
 */
export interface ClubAccessContext {
  role?: string;
  userId?: string | null;
}

/** Campo pelo qual a listagem pode ser ordenada. */
export type ClubSortField = (typeof CLUB_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type ClubSortOrder = 'ASC' | 'DESC';

/**
 * As pessoas que um aviso de clubinho alcança.
 *
 * Só quem pode receber entra aqui: professor desativado e quem se descadastrou
 * já ficaram de fora antes de a lista ser montada.
 */
export interface ClubRecipients {
  clubId: string;
  clubNumber: number;
  teachers: EmailRecipient[];
  /** Nulo quando o clubinho ainda não tem coordenador vinculado. */
  coordinator: EmailRecipient | null;
}
