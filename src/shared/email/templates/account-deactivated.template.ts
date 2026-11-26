import { EMAIL_SUBJECTS } from '../constants';
import { AccountDeactivatedEmailData, EmailContent } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { composeBody, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Seu acesso foi suspenso';

/** Aviso de conta desativada. É reversível, e o texto diz isso. */
export function accountDeactivatedEmail(
  data: AccountDeactivatedEmailData,
): EmailContent {
  const reversible =
    'A suspensão pode ser desfeita: se você acha que houve engano, fale com a coordenação.';

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph('Seu acesso à plataforma foi suspenso pela coordenação.'),
      paragraph(
        'Seus dados continuam guardados — o que mudou é que a entrada está bloqueada por enquanto.',
      ),
      note(reversible),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'Seu acesso à plataforma foi suspenso pela coordenação.',
    'Seus dados continuam guardados — o que mudou é que a entrada está bloqueada por enquanto.',
    '',
    reversible,
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.accountDeactivated, html, text };
}
