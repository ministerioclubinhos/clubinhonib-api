import { EMAIL_SUBJECTS } from '../constants';
import { AccountDeletedEmailData, EmailContent } from '../types';
import { joinTextLines } from '../utils';
import { alertNote, composeBody, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Sua conta foi encerrada';

/**
 * Aviso de conta excluída.
 *
 * Sem rodapé de descadastro: a conta não existe mais, e não há token a emitir
 * para quem já não está na base. É também o último e-mail que este endereço
 * recebe.
 */
export function accountDeletedEmail(
  data: AccountDeletedEmailData,
): EmailContent {
  const warning =
    'Se você não pediu isso e acha que houve engano, procure a coordenação: será preciso fazer um cadastro novo.';

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph('Sua conta na plataforma do Clubinho foi encerrada.'),
      paragraph(
        'O acesso não funciona mais, e este é o último e-mail que você recebe por aqui. Obrigado pelo tempo que você dedicou ao Clubinho.',
      ),
      alertNote(warning),
    ]),
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'Sua conta na plataforma do Clubinho foi encerrada.',
    'O acesso não funciona mais, e este é o último e-mail que você recebe por aqui. Obrigado pelo tempo que você dedicou ao Clubinho.',
    '',
    warning,
  ]);

  return { subject: EMAIL_SUBJECTS.accountDeleted, html, text };
}
