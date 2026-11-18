import { SCHEDULING_ENABLED_ENV } from './constants';

/**
 * Lê a chave que liga o agendador.
 *
 * Só `true` e `1` ligam. Qualquer outro valor — inclusive ausente, vazio ou um
 * `"false"` escrito à toa — deixa desligado: o custo de um aviso que não sai é
 * um clique no painel, e o de um aviso duplicado sai para toda a base.
 */
export function isSchedulerEnabled(
  read: (key: string) => string | undefined,
): boolean {
  const value = read(SCHEDULING_ENABLED_ENV)?.trim().toLowerCase();
  return value === 'true' || value === '1';
}

/** Duração legível no log, sem casa decimal sobrando. */
export function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

/** Mensagem de um erro de origem desconhecida, sem `any`. */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
