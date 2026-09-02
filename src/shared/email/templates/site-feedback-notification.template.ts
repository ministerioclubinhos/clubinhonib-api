import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, SiteFeedbackNotificationEmailData } from '../types';
import { formatBrazilianDateTime } from '../utils';
import { internalNoticeEmail } from './internal-notice';

/** Nota em estrelas, para dar o tamanho da avaliação de relance. */
function stars(rating: number, maxRating: number): string {
  const filled = Math.max(0, Math.min(rating, maxRating));
  return '★'.repeat(filled) + '☆'.repeat(maxRating - filled);
}

/**
 * Aviso interno de uma avaliação recebida pelo site. O conteúdo vem de
 * formulário público, então cada campo é escapado pelos blocos.
 */
export function siteFeedbackNotificationEmail(
  data: SiteFeedbackNotificationEmailData,
): EmailContent {
  return internalNoticeEmail({
    subject: EMAIL_SUBJECTS.siteFeedbackNotification,
    title: 'Nova avaliação do site',
    intro: 'Uma nova avaliação do site foi enviada.',
    detailsHeading: 'Detalhes da avaliação',
    rows: [
      {
        label: 'Nota',
        value: `${stars(data.rating, data.maxRating)}  ${data.rating} de ${data.maxRating}`,
      },
      { label: 'Categoria', value: data.category },
      { label: 'Nome', value: data.name },
      { label: 'E-mail', value: data.email ?? '', as: 'email' },
      { label: 'Data', value: formatBrazilianDateTime(data.receivedAt) },
    ],
    sections: [{ heading: 'Comentário', text: data.comment }],
  });
}
