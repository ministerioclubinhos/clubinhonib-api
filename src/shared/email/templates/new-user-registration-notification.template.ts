import { EMAIL_SUBJECTS } from '../constants';
import {
  EmailContent,
  NewUserRegistrationNotificationEmailData,
} from '../types';
import { formatBrazilianDateTime } from '../utils';
import { internalNoticeEmail } from './internal-notice';

/** Como a pessoa chegou ao cadastro. */
const PROVIDER_LABELS: Record<string, string> = {
  google: 'Conta Google',
};

/** Aviso interno de um novo pré-cadastro de usuário no site. */
export function newUserRegistrationNotificationEmail(
  data: NewUserRegistrationNotificationEmailData,
): EmailContent {
  return internalNoticeEmail({
    subject: EMAIL_SUBJECTS.newUserRegistrationNotification,
    title: 'Novo pré-cadastro de usuário',
    intro: 'Um novo usuário realizou pré-cadastro no site.',
    detailsHeading: 'Detalhes do usuário',
    rows: [
      { label: 'Nome', value: data.name || 'Não informado' },
      { label: 'E-mail', value: data.email, as: 'email' },
      {
        label: 'Tipo de cadastro',
        value: PROVIDER_LABELS[data.provider] ?? 'Cadastro normal',
      },
      { label: 'Data', value: formatBrazilianDateTime(data.registeredAt) },
    ],
  });
}
