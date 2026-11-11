import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, WeekMaterialAnnouncementEmailData } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, linkFallback, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Novo material da semana';
const SPECIAL_TITLE = 'Novo material especial';

/**
 * Aviso de que uma página de material semanal foi publicada.
 *
 * Vai para toda a base por cópia oculta, então não traz saudação com nome: o
 * mesmo conteúdo serve para todos os destinatários do lote.
 */
export function weekMaterialAnnouncementEmail(
  data: WeekMaterialAnnouncementEmailData,
): EmailContent {
  const title = data.special ? SPECIAL_TITLE : TITLE;
  const html = renderEmailLayout({
    title,
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
    title,
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

  return {
    subject: data.special
      ? EMAIL_SUBJECTS.specialMaterialAnnouncement
      : EMAIL_SUBJECTS.weekMaterialAnnouncement,
    html,
    text,
  };
}
