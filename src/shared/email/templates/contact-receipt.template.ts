import { EMAIL_SUBJECTS } from '../constants';
import { ContactReceiptEmailData, EmailContent } from '../types';
import { formatBrazilianDateTime, joinTextLines } from '../utils';
import { composeBody, heading, note, paragraph, quoteBlock } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Recebemos sua mensagem';

/**
 * Confirmação para quem escreveu pelo formulário de contato.
 *
 * Devolve a mensagem inteira porque o formulário público não guarda nada do
 * lado de quem escreveu: sem esta cópia, a pessoa não tem registro nenhum do
 * que enviou nem prova de que chegou.
 *
 * Sem rodapé de descadastro: quem escreve pelo site não está na base, e não há
 * lista da qual sair.
 */
export function contactReceiptEmail(
  data: ContactReceiptEmailData,
): EmailContent {
  const answer =
    'A coordenação responde por aqui mesmo, assim que puder. Não é preciso escrever de novo.';

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.name,
    body: composeBody([
      paragraph('Sua mensagem chegou até a coordenação do Clubinho.'),
      heading('O que você enviou'),
      quoteBlock(data.message),
      note(`Enviada em ${formatBrazilianDateTime(data.receivedAt)}.`),
      note(answer),
    ]),
  });

  const text = joinTextLines([
    `Olá, ${data.name}!`,
    '',
    'Sua mensagem chegou até a coordenação do Clubinho.',
    '',
    'O que você enviou:',
    data.message,
    '',
    `Enviada em ${formatBrazilianDateTime(data.receivedAt)}.`,
    answer,
  ]);

  return { subject: EMAIL_SUBJECTS.contactReceipt, html, text };
}
