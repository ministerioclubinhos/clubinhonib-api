import { EMAIL_LINK_TTL_MINUTES, EMAIL_SUBJECTS } from '../constants';
import { EmailContent, PasswordRecoveryEmailData } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, linkFallback, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Recuperação de senha';

/** E-mail com o link para criar uma nova senha. */
export function passwordRecoveryEmail(
  data: PasswordRecoveryEmailData,
): EmailContent {
  const validity = `Este link é válido por ${EMAIL_LINK_TTL_MINUTES.passwordRecovery} minutos.`;

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph('Recebemos uma solicitação para redefinir sua senha.'),
      paragraph('Clique no botão abaixo para criar uma nova senha:'),
      button('Redefinir senha', data.resetLink),
      linkFallback(data.resetLink),
      note(validity),
      note(
        'Se não foi você quem pediu, ignore este e-mail: sua senha continua a mesma.',
      ),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'Recebemos uma solicitação para redefinir sua senha.',
    'Acesse o link abaixo para criar uma nova senha:',
    data.resetLink,
    '',
    validity,
    'Se não foi você quem pediu, ignore este e-mail: sua senha continua a mesma.',
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.passwordRecovery, html, text };
}
