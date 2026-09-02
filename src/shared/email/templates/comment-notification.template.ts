import { EMAIL_SUBJECTS } from '../constants';
import { CommentNotificationEmailData, EmailContent } from '../types';
import { formatBrazilianDateTime } from '../utils';
import { internalNoticeEmail } from './internal-notice';

/** Aviso interno de um comentário postado por um professor. */
export function commentNotificationEmail(
  data: CommentNotificationEmailData,
): EmailContent {
  return internalNoticeEmail({
    subject: EMAIL_SUBJECTS.commentNotification,
    title: 'Novo comentário na Área do Professor',
    intro: 'Novo comentário postado na Área do Professor.',
    detailsHeading: 'Detalhes do comentário',
    rows: [
      { label: 'Nome', value: data.name },
      { label: 'Clubinho', value: data.clubinho },
      { label: 'Bairro', value: data.neighborhood },
      { label: 'Data', value: formatBrazilianDateTime(data.createdAt) },
    ],
    sections: [{ heading: 'Comentário', text: data.comment }],
  });
}
