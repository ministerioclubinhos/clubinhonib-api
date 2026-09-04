import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, WeekMaterialAnnouncementEmailData } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, linkFallback, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Novo material da semana';

/**
 * Aviso de que uma página de material semanal foi publicada.
 *
 * Vai para toda a base por cópia oculta, então não traz saudação com nome: o
 * mesmo conteúdo serve para todos os destinatários do lote.
 */
export function weekMaterialAnnouncementEmail(
  data: WeekMaterialAnnouncementEmailData,
): EmailContent {
  const html = renderEmailLayout({
    title: TITLE,
    body: composeBody([
      paragraph(`Já está no ar: ${data.title}`),
      data.subtitle ? paragraph(data.subtitle) : '',
      data.description ? paragraph(data.description) : '',
      button('Ver material', data.materialLink),
      linkFallback(data.materialLink),
      note('Bom preparo e uma ótima visita!'),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    'Novo material da semana',
    '',
    `Já está no ar: ${data.title}`,
    data.subtitle ?? '',
    data.description ?? '',
    '',
    'Acesse por aqui:',
    data.materialLink,
    '',
    'Bom preparo e uma ótima visita!',
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.weekMaterialAnnouncement, html, text };
}
