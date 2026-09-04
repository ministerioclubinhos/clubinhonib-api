import { EMAIL_LINK_TTL_MINUTES, EMAIL_SUBJECTS } from '../constants';
import { EmailContent, EmailVerificationEmailData } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, linkFallback, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Confirme seu e-mail';

/** Horas de validade do link, derivadas do prazo em minutos. */
const VALIDITY_HOURS = EMAIL_LINK_TTL_MINUTES.emailVerification / 60;

/** E-mail com o link que ativa a conta. */
export function emailVerificationEmail(
  data: EmailVerificationEmailData,
): EmailContent {
  const validity = `Este link é válido por ${VALIDITY_HOURS} horas.`;

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph('Falta pouco para sua conta ficar pronta.'),
      paragraph(
        'Confirme que este endereço é seu para ativar o acesso à plataforma:',
      ),
      button('Confirmar e-mail', data.verificationLink),
      linkFallback(data.verificationLink),
      note(validity),
      note('Se você não criou uma conta, pode ignorar este e-mail.'),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'Falta pouco para sua conta ficar pronta.',
    'Confirme que este endereço é seu para ativar o acesso à plataforma:',
    data.verificationLink,
    '',
    validity,
    'Se você não criou uma conta, pode ignorar este e-mail.',
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.emailVerification, html, text };
}
