import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, InformativePublishedEmailData } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, linkFallback, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Novo informativo';

/**
 * Aviso de informativo publicado.
 *
 * Vai para toda a base sem saudação com nome: o mesmo conteúdo serve para todos
 * os destinatários, como nos demais avisos gerais.
 */
export function informativePublishedEmail(
  data: InformativePublishedEmailData,
): EmailContent {
  const html = renderEmailLayout({
    title: TITLE,
    body: composeBody([
      paragraph(`Acabou de sair: ${data.title}`),
      data.description ? paragraph(data.description) : '',
      button('Ler o informativo', data.informativeLink),
      linkFallback(data.informativeLink),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    TITLE,
    '',
    `Acabou de sair: ${data.title}`,
    data.description ?? '',
    '',
    'Leia por aqui:',
    data.informativeLink,
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.informativePublished, html, text };
}
