import { EMAIL_SUBJECTS } from '../constants';
import { AccountApprovedEmailData, EmailContent } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Seu cadastro foi aprovado';

/**
 * Aviso de que o pré-cadastro foi liberado.
 *
 * Fecha o único fluxo que estava pela metade: a coordenação era avisada do
 * pré-cadastro, e a pessoa aprovada não — ela só descobria tentando entrar de
 * novo, sem saber quando valeria a pena tentar.
 */
export function accountApprovedEmail(
  data: AccountApprovedEmailData,
): EmailContent {
  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph('Boa notícia: seu cadastro foi aprovado pela coordenação.'),
      paragraph(
        'Seu acesso já está liberado. Entre com o mesmo e-mail e a mesma senha que você cadastrou.',
      ),
      button('Entrar na plataforma', data.loginLink),
      note('Bom trabalho, e seja bem-vindo ao Clubinho!'),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'Boa notícia: seu cadastro foi aprovado pela coordenação.',
    'Seu acesso já está liberado. Entre com o mesmo e-mail e a mesma senha que você cadastrou:',
    data.loginLink,
    '',
    'Bom trabalho, e seja bem-vindo ao Clubinho!',
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.accountApproved, html, text };
}
