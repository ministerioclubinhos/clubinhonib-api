import { EMAIL_SUBJECTS } from '../constants';
import { EmailAddressChangedEmailData, EmailContent } from '../types';
import { formatBrazilianDateTime, joinTextLines } from '../utils';
import { alertNote, button, composeBody, dataTable, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Seu e-mail de acesso mudou';

/**
 * Aviso de que o endereço de login foi trocado — enviado ao endereço **antigo**.
 *
 * É o único e-mail da aplicação que vai para um endereço que não é mais o da
 * conta, e é essa a razão de ele existir: quem troca o e-mail com uma sessão
 * roubada passa a receber tudo, inclusive a recuperação de senha. Este aviso é
 * a única coisa que ainda chega a quem é dono da conta.
 *
 * Sem rodapé de descadastro: não é aviso, é a resposta a uma mudança de
 * credencial, e não há o que cancelar em um endereço que saiu da conta.
 */
export function emailAddressChangedEmail(
  data: EmailAddressChangedEmailData,
): EmailContent {
  const warning =
    'Se não foi você quem fez essa troca, procure a coordenação agora: quem tem o endereço novo consegue redefinir a senha e entrar na sua conta.';

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph(
        'O endereço usado para entrar na plataforma foi alterado. A partir de agora, o acesso é feito com o endereço novo.',
      ),
      dataTable([
        { label: 'Novo endereço', value: data.newEmail, as: 'email' },
        { label: 'Quando', value: formatBrazilianDateTime(data.changedAt) },
      ]),
      alertNote(warning),
      data.supportUrl ? button('Falar com a coordenação', data.supportUrl) : '',
    ]),
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'O endereço usado para entrar na plataforma foi alterado. A partir de agora, o acesso é feito com o endereço novo.',
    '',
    `Novo endereço: ${data.newEmail}`,
    `Quando: ${formatBrazilianDateTime(data.changedAt)}`,
    '',
    warning,
    ...(data.supportUrl ? ['', data.supportUrl] : []),
  ]);

  return { subject: EMAIL_SUBJECTS.emailAddressChanged, html, text };
}
