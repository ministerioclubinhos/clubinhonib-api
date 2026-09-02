import { EMAIL_SUBJECTS } from '../constants';
import { ContactNotificationEmailData, EmailContent } from '../types';
import { formatBrazilianDateTime } from '../utils';
import { internalNoticeEmail } from './internal-notice';

/**
 * Aviso interno de um contato recebido pelo site. O conteúdo vem de formulário
 * público, então cada campo é escapado pelos blocos antes de virar HTML.
 */
export function contactNotificationEmail(
  data: ContactNotificationEmailData,
): EmailContent {
  return internalNoticeEmail({
    subject: EMAIL_SUBJECTS.contactNotification,
    title: 'Novo contato',
    intro: 'Um novo contato chegou pelo site.',
    detailsHeading: 'Detalhes do contato',
    rows: [
      { label: 'Nome', value: data.name },
      { label: 'E-mail', value: data.email, as: 'email' },
      { label: 'Telefone', value: data.phone, as: 'phone' },
      { label: 'Data', value: formatBrazilianDateTime(data.receivedAt) },
    ],
    sections: [{ heading: 'Mensagem', text: data.message }],
  });
}
