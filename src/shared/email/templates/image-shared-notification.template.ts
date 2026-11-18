import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, ImageSharedNotificationEmailData } from '../types';
import { formatBrazilianDateTime } from '../utils';
import { internalNoticeEmail } from './internal-notice';

/** Aviso interno de novas imagens do Clubinho compartilhadas no site. */
export function imageSharedNotificationEmail(
  data: ImageSharedNotificationEmailData,
): EmailContent {
  return internalNoticeEmail({
    subject: EMAIL_SUBJECTS.imageSharedNotification,
    title: 'Novas imagens compartilhadas',
    intro: 'Novas imagens do Clubinho foram compartilhadas no site.',
    detailsHeading: 'Detalhes do envio',
    rows: [
      { label: 'Legenda', value: data.caption },
      { label: 'Autor', value: data.authorName ?? '' },
      { label: 'E-mail do autor', value: data.authorEmail ?? '', as: 'email' },
      { label: 'Data', value: formatBrazilianDateTime(data.sharedAt) },
    ],
    sections: [{ heading: 'Descrição', text: data.description }],
  });
}
