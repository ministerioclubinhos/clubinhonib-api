/**
 * Gera um HTML com todos os e-mails do sistema, um do lado do outro, para
 * conferir o layout sem precisar disparar nada.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/email/preview.ts
 *   → abre email-preview.html no navegador
 */
import { writeFileSync } from 'node:fs';
import { EmailContent } from '../../src/shared/email/types';
import {
  commentNotificationEmail,
  contactNotificationEmail,
  emailVerificationEmail,
  eventCancelledEmail,
  eventCreatedEmail,
  eventUpdatedEmail,
  ideaSharedNotificationEmail,
  imageSharedNotificationEmail,
  newUserRegistrationNotificationEmail,
  passwordChangedEmail,
  passwordRecoveryEmail,
  siteFeedbackNotificationEmail,
  weekMaterialAnnouncementEmail,
} from '../../src/shared/email/templates';

const LINK = 'https://clubinhonib.com/exemplo/token-de-exemplo';
const NOW = new Date('2026-04-12T18:30:00Z');

const samples: { name: string; content: EmailContent }[] = [
  {
    name: 'Recuperação de senha',
    content: passwordRecoveryEmail({ recipientName: 'Ana', resetLink: LINK }),
  },
  {
    name: 'Senha alterada',
    content: passwordChangedEmail({
      recipientName: 'Ana',
      loginLink: 'https://clubinhonib.com',
    }),
  },
  {
    name: 'Confirmação de e-mail',
    content: emailVerificationEmail({
      recipientName: 'Ana',
      verificationLink: LINK,
    }),
  },
  {
    name: 'Novo material da semana',
    content: weekMaterialAnnouncementEmail({
      title: 'Semana 12 — A ovelha perdida',
      subtitle: 'Tema da visita',
      description: 'Vídeo, roteiro e atividades para imprimir.',
      materialLink: LINK,
    }),
  },
  {
    name: 'Evento criado',
    content: eventCreatedEmail({
      title: 'Festa da Família',
      date: '2026-05-09',
      location: 'Salão da igreja · Centro · São Paulo - SP',
      description: 'Traga a família toda. Teremos lanche e brincadeiras.',
      agendaLink: 'https://clubinhonib.com/eventos',
    }),
  },
  {
    name: 'Evento atualizado',
    content: eventUpdatedEmail({
      title: 'Festa da Família',
      date: '2026-05-16',
      location: 'Salão da igreja',
      agendaLink: 'https://clubinhonib.com/eventos',
    }),
  },
  {
    name: 'Evento cancelado',
    content: eventCancelledEmail({
      title: 'Festa da Família',
      date: '2026-05-16',
      location: 'Salão da igreja',
      agendaLink: 'https://clubinhonib.com/eventos',
    }),
  },
  {
    name: 'Novo contato',
    content: contactNotificationEmail({
      name: 'Marina Souza',
      email: 'marina@exemplo.com',
      phone: '(11) 98888-7777',
      message: 'Gostaria de ajudar como voluntária nos clubinhos da região.',
      receivedAt: NOW,
    }),
  },
  {
    name: 'Avaliação do site',
    content: siteFeedbackNotificationEmail({
      name: 'Marina Souza',
      email: 'marina@exemplo.com',
      rating: 4,
      maxRating: 5,
      category: 'Facilidade de uso',
      comment: 'O site é ótimo, mas achei o menu confuso no celular.',
      receivedAt: NOW,
    }),
  },
  {
    name: 'Novo comentário',
    content: commentNotificationEmail({
      name: 'Professor João',
      clubinho: '12',
      neighborhood: 'Centro',
      comment: 'As crianças amaram a atividade desta semana!',
      createdAt: NOW,
    }),
  },
  {
    name: 'Ideia compartilhada',
    content: ideaSharedNotificationEmail({
      title: 'Brincadeira do paraquedas',
      description: 'Funciona muito bem com turmas grandes.',
      authorName: 'Professora Rita',
      authorEmail: 'rita@exemplo.com',
      sharedAt: NOW,
    }),
  },
  {
    name: 'Imagens compartilhadas',
    content: imageSharedNotificationEmail({
      caption: 'Clubinho 12 — encontro de abril',
      description: 'Fotos do encontro da semana passada.',
      authorName: 'Professora Rita',
      sharedAt: NOW,
    }),
  },
  {
    name: 'Novo pré-cadastro',
    content: newUserRegistrationNotificationEmail({
      name: 'Carlos Lima',
      email: 'carlos@exemplo.com',
      provider: 'google',
      registeredAt: NOW,
    }),
  },
];

/**
 * O iframe não herda o tema da página, então cada modelo é mostrado duas
 * vezes: um iframe normal e outro com `color-scheme: dark`, que faz o
 * navegador responder `prefers-color-scheme: dark` lá dentro.
 */
const frame = (html: string, dark: boolean): string => {
  const doc = dark
    ? html.replace(
        '<head>',
        '<head><style>:root { color-scheme: dark; }</style>',
      )
    : html;

  return `<iframe class="${dark ? 'dark' : 'light'}" srcdoc="${doc.replace(/"/g, '&quot;')}"></iframe>`;
};

const cards = samples
  .map(
    ({ name, content }) => `
    <section class="card">
      <header>
        <h2>${name}</h2>
        <p><strong>Assunto:</strong> ${content.subject}</p>
      </header>
      <div class="modes">
        <div><span class="tag">Claro</span>${frame(content.html, false)}</div>
        <div><span class="tag">Escuro</span>${frame(content.html, true)}</div>
      </div>
      <details>
        <summary>Versão em texto puro</summary>
        <pre>${content.text.replace(/</g, '&lt;')}</pre>
      </details>
    </section>`,
  )
  .join('\n');

const page = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Preview dos e-mails</title>
  <style>
    body { margin: 0; padding: 24px; background: #eceff3; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; }
    h1 { color: #30328B; margin-bottom: 4px; }
    .card { background: #fff; border-radius: 12px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 24px; }
    .card h2 { margin: 0 0 4px; font-size: 16px; color: #30328B; }
    .card header p { margin: 0 0 12px; font-size: 13px; color: #6B7280; }
    .modes { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); }
    .tag { display: inline-block; margin-bottom: 6px; padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .5px; text-transform: uppercase; background: #E6E8EC; color: #6B7280; }
    iframe { width: 100%; height: 640px; border: 1px solid #E6E8EC; border-radius: 8px; }
    iframe.light { background: #F4F6F8; }
    iframe.dark { background: #14161A; }
    details { margin-top: 12px; font-size: 13px; color: #6B7280; }
    pre { white-space: pre-wrap; background: #F7F8FA; padding: 12px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Preview dos e-mails</h1>
  <p style="color:#6B7280">${samples.length} modelos, cada um no tema claro e no escuro. Cada quadro é o HTML real enviado.</p>
  ${cards}
</body>
</html>`;

writeFileSync('email-preview.html', page);
console.log(`email-preview.html gerado com ${samples.length} modelos.`);
