import { EMAIL_COLORS } from '../constants';
import { digitsOf, escapeHtml, safeUrl } from '../utils';

/**
 * Peças de conteúdo compartilhadas pelos e-mails. Todo texto que chega aqui é
 * escapado: nenhum template monta HTML com dado cru.
 */

/** Parágrafo comum do corpo. */
export function paragraph(text: string): string {
  return `<p class="text-primary" style="margin: 0 0 16px 0; color: ${EMAIL_COLORS.primaryText}; font-size: 16px; line-height: 1.6;">${escapeHtml(text)}</p>`;
}

/** Título de uma seção dentro do corpo. */
export function heading(text: string): string {
  return `<p class="text-muted" style="margin: 28px 0 12px 0; color: ${EMAIL_COLORS.mutedText}; font-size: 12px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase;">${escapeHtml(text)}</p>`;
}

/**
 * Botão de ação. Um link fora de http(s) não vira botão: o texto some junto,
 * para o e-mail nunca carregar um esquema inesperado.
 */
export function button(label: string, url: string): string {
  const href = safeUrl(url);
  if (!href) return '';

  return `<table border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
        <tr>
          <td align="center" style="background-color: ${EMAIL_COLORS.accent}; border-radius: 8px;">
            <a href="${href}" style="display: inline-block; padding: 14px 28px; color: ${EMAIL_COLORS.cardBackground}; font-size: 15px; font-weight: 700; text-decoration: none;">${escapeHtml(label)}</a>
          </td>
        </tr>
      </table>`;
}

/** O mesmo link em texto, para quem não consegue clicar no botão. */
export function linkFallback(url: string): string {
  const href = safeUrl(url);
  if (!href) return '';

  return `<p class="text-muted" style="margin: 0 0 4px 0; color: ${EMAIL_COLORS.mutedText}; font-size: 13px;">Ou copie e cole o link abaixo no seu navegador:</p>
      <p class="text-primary" style="margin: 0 0 16px 0; font-size: 13px; color: ${EMAIL_COLORS.primaryText}; word-break: break-all;">${href}</p>`;
}

/** Observação discreta, como o prazo de validade de um link. */
export function note(text: string): string {
  return `<p class="text-muted" style="margin: 12px 0 0 0; color: ${EMAIL_COLORS.mutedText}; font-size: 13px; line-height: 1.5;">${escapeHtml(text)}</p>`;
}

/** Um par rótulo/valor da tabela de dados. */
export interface DataRow {
  label: string;
  value: string;
  /** Transforma o valor em link de e-mail, telefone ou endereço web. */
  as?: 'text' | 'email' | 'phone' | 'url';
}

function renderValue(row: DataRow): string {
  const value = escapeHtml(row.value);
  const style = `color: ${EMAIL_COLORS.primaryText}; font-size: 15px; font-weight: 600; text-decoration: none;`;

  if (row.as === 'email') {
    return `<a href="mailto:${value}" class="text-primary" style="${style}">${value}</a>`;
  }

  if (row.as === 'phone') {
    return `<a href="tel:${escapeHtml(digitsOf(row.value))}" class="text-primary" style="${style}">${value}</a>`;
  }

  if (row.as === 'url') {
    const href = safeUrl(row.value);
    // Uma URL de esquema inesperado continua visível como texto, sem virar link.
    return href
      ? `<a href="${href}" class="text-primary" style="${style}">${value}</a>`
      : `<span class="text-primary" style="${style}">${value}</span>`;
  }

  return `<span class="text-primary" style="${style}">${value}</span>`;
}

/**
 * Tabela de rótulo e valor.
 *
 * Cada item é uma linha separada por um filete claro, com o rótulo acima do
 * valor — some bem em tela estreita e não precisa de coluna fixa.
 */
export function dataTable(rows: DataRow[]): string {
  const cells = rows
    .map((row, index) => {
      const isLast = index === rows.length - 1;
      const border = isLast
        ? ''
        : ` border-bottom: 1px solid ${EMAIL_COLORS.border};`;

      return `        <tr>
          <td class="border-color" style="padding: 12px 0;${border}">
            <p class="text-muted" style="margin: 0 0 3px 0; color: ${EMAIL_COLORS.mutedText}; font-size: 12px; letter-spacing: 0.4px; text-transform: uppercase;">${escapeHtml(row.label)}</p>
            ${renderValue(row)}
          </td>
        </tr>`;
    })
    .join('\n');

  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
${cells}
      </table>`;
}

/**
 * Bloco de texto longo, preservando as quebras de linha do original. O filete
 * verde à esquerda marca a citação sem contornar tudo.
 */
export function quoteBlock(text: string): string {
  return `<table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 8px 0;">
        <tr>
          <td class="surface-bg" style="background-color: ${EMAIL_COLORS.surface}; border-left: 3px solid ${EMAIL_COLORS.brandGreen}; border-radius: 0 6px 6px 0; padding: 16px 18px;">
            <p class="text-primary" style="margin: 0; color: ${EMAIL_COLORS.primaryText}; font-size: 15px; line-height: 1.6; white-space: pre-line;">${escapeHtml(text)}</p>
          </td>
        </tr>
      </table>`;
}

/** Junta os blocos do corpo já com a indentação da casca. */
export function composeBody(blocks: string[]): string {
  return blocks
    .filter((block) => block.length > 0)
    .map((block) => `                ${block}`)
    .join('\n');
}
