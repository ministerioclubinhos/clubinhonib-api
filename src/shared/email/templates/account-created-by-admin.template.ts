import { EMAIL_SUBJECTS } from '../constants';
import { AccountCreatedByAdminEmailData, EmailContent } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import {
  button,
  composeBody,
  dataTable,
  linkFallback,
  note,
  paragraph,
} from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Sua conta no Clubinho está pronta';

/**
 * Boas-vindas de uma conta criada pela coordenação.
 *
 * Leva um link para a pessoa **definir** a própria senha, e nunca a senha em
 * si: o que vai por e-mail fica na caixa de entrada para sempre, e uma senha
 * ali é uma credencial exposta a cada vazamento futuro daquela conta de e-mail.
 */
export function accountCreatedByAdminEmail(
  data: AccountCreatedByAdminEmailData,
): EmailContent {
  const validity = `Este link é válido por ${data.validityHours} horas. Depois disso, use "Esqueci minha senha" para pedir outro.`;

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph(
        'A coordenação criou uma conta para você na plataforma do Clubinho.',
      ),
      dataTable([{ label: 'Seu papel', value: data.role }]),
      paragraph('Defina sua senha para começar a usar:'),
      button('Definir minha senha', data.passwordSetupLink),
      linkFallback(data.passwordSetupLink),
      note(validity),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'A coordenação criou uma conta para você na plataforma do Clubinho.',
    `Seu papel: ${data.role}`,
    '',
    'Defina sua senha para começar a usar:',
    data.passwordSetupLink,
    '',
    validity,
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.accountCreatedByAdmin, html, text };
}
