import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, IdeaSharedNotificationEmailData } from '../types';
import { formatBrazilianDateTime } from '../utils';
import { internalNoticeEmail } from './internal-notice';

/** Aviso interno de uma nova ideia compartilhada no site. */
export function ideaSharedNotificationEmail(
  data: IdeaSharedNotificationEmailData,
): EmailContent {
  return internalNoticeEmail({
    subject: EMAIL_SUBJECTS.ideaSharedNotification,
    title: 'Nova ideia compartilhada',
    intro: 'Uma nova ideia foi compartilhada no site.',
    detailsHeading: 'Detalhes da ideia',
    // Autor e e-mail são opcionais; linha sem valor não aparece.
    rows: [
      { label: 'Título', value: data.title },
      { label: 'Autor', value: data.authorName ?? '' },
      { label: 'E-mail do autor', value: data.authorEmail ?? '', as: 'email' },
      { label: 'Data', value: formatBrazilianDateTime(data.sharedAt) },
    ],
    sections: [{ heading: 'Descrição', text: data.description }],
  });
}
