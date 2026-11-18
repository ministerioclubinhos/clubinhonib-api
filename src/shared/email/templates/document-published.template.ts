import { EMAIL_SUBJECTS } from '../constants';
import { DocumentPublishedEmailData, EmailContent } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, linkFallback, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Novo documento disponível';

/**
 * Aviso de documento novo na área do professor.
 *
 * A observação sobre entrar na plataforma não é enfeite: a rota de um documento
 * nasce fechada (`public: false`), então o link só abre para quem tem sessão.
 */
export function documentPublishedEmail(
  data: DocumentPublishedEmailData,
): EmailContent {
  const html = renderEmailLayout({
    title: TITLE,
    body: composeBody([
      paragraph(`Um documento novo entrou na Área do Professor: ${data.name}`),
      data.description ? paragraph(data.description) : '',
      button('Abrir o documento', data.documentLink),
      linkFallback(data.documentLink),
      note('Você precisa estar logado na plataforma para abrir o documento.'),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    TITLE,
    '',
    `Um documento novo entrou na Área do Professor: ${data.name}`,
    data.description ?? '',
    '',
    'Abra por aqui:',
    data.documentLink,
    '',
    'Você precisa estar logado na plataforma para abrir o documento.',
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.documentPublished, html, text };
}
