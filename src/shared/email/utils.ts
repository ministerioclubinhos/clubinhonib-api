import { EMAIL_ALLOWED_URL_SCHEMES } from './constants';

/**
 * Escapa o texto para uso dentro do HTML do e-mail.
 *
 * Todo dado que vem de fora — nome, mensagem do formulário público, telefone —
 * passa por aqui. Sem isso, quem preenche o formulário escolhe o HTML que o
 * administrador abre na caixa de entrada.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Devolve a URL somente quando ela é http(s); qualquer outro esquema
 * (`javascript:`, `data:`) vira string vazia para não virar link no e-mail.
 */
export function safeUrl(value: string): string {
  try {
    const parsed = new URL(value);
    const scheme =
      parsed.protocol as (typeof EMAIL_ALLOWED_URL_SCHEMES)[number];
    return EMAIL_ALLOWED_URL_SCHEMES.includes(scheme) ? escapeHtml(value) : '';
  } catch {
    return '';
  }
}

/** Só os dígitos, para montar um `tel:`. */
export function digitsOf(value: string): string {
  return value.replace(/\D/g, '');
}

/** Data e hora no fuso e no formato usados pela equipe. */
export function formatBrazilianDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Junta as linhas do corpo em texto puro, sem espaços sobrando. */
export function joinTextLines(lines: string[]): string {
  return lines
    .map((line) => line.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Data de um evento no formato do Brasil.
 *
 * Aceita `Date` e string porque uma coluna `date` do MySQL chega como
 * `YYYY-MM-DD`. A string é lida pelos componentes, sem passar por UTC: um
 * `new Date('2026-03-10')` vira o dia anterior em qualquer fuso negativo.
 */
export function formatEventDate(value: Date | string): string {
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}
