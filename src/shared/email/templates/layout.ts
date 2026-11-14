import {
  EMAIL_BRAND,
  EMAIL_COLORS,
  EMAIL_DISPLAY_FALLBACK,
  EMAIL_MAX_WIDTH_PX,
  UNSUBSCRIBE_FOOTER,
} from '../constants';
import { escapeHtml, safeUrl } from '../utils';

export interface EmailLayoutParams {
  /** Aparece na aba do cliente de e-mail e no cabeçalho. */
  title: string;
  /** Quando presente, abre o conteúdo com "Olá, <nome>!". */
  recipientName?: string;
  /** HTML do miolo, montado com os blocos. */
  body: string;
  /**
   * Link que cancela o recebimento dos avisos, já com o token de quem recebe.
   *
   * Ausente nos e-mails cujo destinatário não é uma pessoa da base — os avisos
   * internos para a equipe —, onde não há token a emitir nem o que cancelar.
   */
  unsubscribeUrl?: string;
}

/**
 * A casca de todos os e-mails: faixa da marca, cartão central e rodapé.
 *
 * O layout usa tabelas e estilo inline porque é o único conjunto que os
 * clientes de e-mail renderizam de forma parecida; as classes existem só para
 * as media queries de mobile e de tema escuro, que Gmail e Outlook aplicam.
 *
 * Cada cor da marca tem um papel e só aparece nele: o azul royal é a faixa do
 * cabeçalho, o verde fecha essa faixa e pinta o botão, o amarelo marca a
 * citação e o vermelho fica no aviso. Nenhuma delas vira contorno de campo.
 */
export function renderEmailLayout({
  title,
  recipientName,
  body,
  unsubscribeUrl,
}: EmailLayoutParams): string {
  const year = new Date().getFullYear();
  const safeTitle = escapeHtml(title);
  // Fica discreto de propósito: menor que o resto do rodapé e em tom neutro.
  // Precisa estar sempre ao alcance, sem competir com o conteúdo do e-mail.
  const safeUnsubscribe = unsubscribeUrl ? safeUrl(unsubscribeUrl) : null;
  const unsubscribeLine = safeUnsubscribe
    ? `<p class="text-muted" style="margin: 10px 0 0; color: ${EMAIL_COLORS.mutedText}; font-size: 11px; line-height: 1.5;">${UNSUBSCRIBE_FOOTER.question} <a href="${safeUnsubscribe}" style="color: ${EMAIL_COLORS.mutedText}; text-decoration: underline;">${UNSUBSCRIBE_FOOTER.action}</a>.</p>`
    : '';
  const greeting = recipientName?.trim()
    ? `<p class="text-primary" style="margin: 0 0 20px 0; color: ${EMAIL_COLORS.primaryText}; font-size: 17px; font-weight: 700;">Olá, ${escapeHtml(recipientName.trim())}!</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${safeTitle}</title>
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=Lilita+One&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <style>
    body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }

    @media only screen and (max-width: ${EMAIL_MAX_WIDTH_PX}px) {
      .email-container { width: 100% !important; border-radius: 0 !important; }
      .content-padding { padding: 28px 22px !important; }
      .header-padding { padding: 26px 22px !important; }
      .footer-padding { padding: 24px 22px !important; }
      .brand-mobile { font-size: 14px !important; }
      .title-mobile { font-size: 20px !important; }
    }

    /*
     * Tema escuro. O cabeçalho já é uma faixa escura com texto branco em
     * qualquer modo, então não entra aqui: é o trecho que mais sofria quando o
     * cliente invertia as cores por conta própria.
     */
    @media (prefers-color-scheme: dark) {
      .body-bg { background-color: #14161A !important; }
      .card-bg { background-color: #1E2126 !important; }
      .surface-bg { background-color: #23272E !important; }
      .text-primary { color: #EDEFF3 !important; }
      .text-muted { color: #9BA3AF !important; }
      .border-color { border-color: #333840 !important; }
      .alert-bg { background-color: #2E1F20 !important; }
    }

    /* O Outlook.com marca o corpo em vez de suportar a media query acima. */
    [data-ogsc] .body-bg { background-color: #14161A !important; }
    [data-ogsc] .card-bg { background-color: #1E2126 !important; }
    [data-ogsc] .surface-bg { background-color: #23272E !important; }
    [data-ogsc] .text-primary { color: #EDEFF3 !important; }
    [data-ogsc] .text-muted { color: #9BA3AF !important; }
    [data-ogsc] .border-color { border-color: #333840 !important; }
    [data-ogsc] .alert-bg { background-color: #2E1F20 !important; }
  </style>
</head>
<body class="body-bg" style="margin: 0; padding: 0; background-color: ${EMAIL_COLORS.bodyBackground}; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" class="body-bg" style="background-color: ${EMAIL_COLORS.bodyBackground}; padding: 40px 12px;">
    <tr>
      <td align="center">
        <!--[if mso]>
        <table role="presentation" align="center" style="width:${EMAIL_MAX_WIDTH_PX}px;">
        <tr>
        <td style="padding:0;">
        <![endif]-->
        <table class="email-container card-bg" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: ${EMAIL_MAX_WIDTH_PX}px; background-color: ${EMAIL_COLORS.cardBackground}; border-radius: 14px; overflow: hidden; box-shadow: 0 1px 3px rgba(48, 50, 139, 0.08);">
          <tr>
            <td class="header-padding" style="background-color: ${EMAIL_COLORS.headerBackground}; border-bottom: 4px solid ${EMAIL_COLORS.brandGreen}; padding: 28px 32px;">
              <p class="brand-mobile" style="margin: 0 0 10px 0; color: ${EMAIL_COLORS.brandGreen}; font-family: 'Lilita One', ${EMAIL_DISPLAY_FALLBACK}; font-size: 15px; font-weight: 400; letter-spacing: 1.4px; text-transform: uppercase;">${EMAIL_BRAND.name}</p>
              <p class="title-mobile" style="margin: 0; color: ${EMAIL_COLORS.onDark}; font-size: 24px; font-weight: 700; line-height: 1.3; letter-spacing: -0.2px;">${safeTitle}</p>
            </td>
          </tr>

          <tr>
            <td class="content-padding" style="padding: 36px 32px;">
              ${greeting}
              <div class="text-primary" style="color: ${EMAIL_COLORS.primaryText}; font-size: 16px; line-height: 1.6;">
${body}
              </div>
            </td>
          </tr>

          <tr>
            <td class="footer-padding border-color" style="border-top: 1px solid ${EMAIL_COLORS.border}; padding: 28px 32px; text-align: center;">
              <p class="text-primary" style="margin: 0; color: ${EMAIL_COLORS.primaryText}; font-size: 12px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">${EMAIL_BRAND.name}</p>
              <p class="text-muted" style="margin: 6px 0 0; color: ${EMAIL_COLORS.mutedText}; font-size: 13px;">${EMAIL_BRAND.tagline}</p>
              <p class="text-muted" style="margin: 14px 0 0; color: ${EMAIL_COLORS.mutedText}; font-size: 11px;">&copy; ${year} ${EMAIL_BRAND.name}</p>
              ${unsubscribeLine}
            </td>
          </tr>
        </table>
        <!--[if mso]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}
