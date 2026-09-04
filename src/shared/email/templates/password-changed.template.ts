import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, PasswordChangedEmailData } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Senha alterada';

/** Aviso de que a senha da conta acabou de mudar. */
export function passwordChangedEmail(
  data: PasswordChangedEmailData,
): EmailContent {
  const warning =
    'Se não foi você, entre em contato com a coordenação imediatamente.';

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph('Sua senha foi alterada com sucesso.'),
      paragraph('Agora você já pode acessar sua conta com a nova senha.'),
      button('Acessar plataforma', data.loginLink),
      note(warning),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'Sua senha foi alterada com sucesso.',
    'Agora você já pode acessar sua conta com a nova senha:',
    data.loginLink,
    '',
    warning,
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.passwordChanged, html, text };
}
