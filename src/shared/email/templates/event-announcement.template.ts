import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, EventAnnouncementEmailData } from '../types';
import { formatEventDate, joinTextLines } from '../utils';
import {
  button,
  composeBody,
  dataTable,
  heading,
  paragraph,
  quoteBlock,
} from './blocks';
import { renderEmailLayout } from './layout';

/**
 * Os três avisos da agenda ficam no mesmo arquivo por serem variações de um
 * conteúdo só: mudam o título, a frase de abertura e o rótulo do botão; os
 * dados do evento são montados uma vez.
 */

/** Blocos com os dados do evento, iguais nos três avisos. */
function eventDetails(data: EventAnnouncementEmailData): string[] {
  return [
    heading('Detalhes do evento'),
    dataTable([
      { label: 'Evento', value: data.title },
      { label: 'Data', value: formatEventDate(data.date) },
      { label: 'Local', value: data.location },
    ]),
    ...(data.description
      ? [heading('Descrição'), quoteBlock(data.description)]
      : []),
  ];
}

/** As mesmas linhas em texto puro. */
function eventDetailsText(data: EventAnnouncementEmailData): string[] {
  return [
    `Evento: ${data.title}`,
    `Data: ${formatEventDate(data.date)}`,
    `Local: ${data.location}`,
    ...(data.description ? ['', 'Descrição:', data.description] : []),
  ];
}

interface EventVariant {
  subject: string;
  title: string;
  intro: string;
  action: string;
  closing?: string;
}

function renderEvent(
  data: EventAnnouncementEmailData,
  variant: EventVariant,
): EmailContent {
  const html = renderEmailLayout({
    title: variant.title,
    body: composeBody([
      paragraph(variant.intro),
      ...eventDetails(data),
      button(variant.action, data.agendaLink),
    ]),
  });

  const text = joinTextLines([
    variant.title,
    '',
    variant.intro,
    '',
    ...eventDetailsText(data),
    '',
    'Veja a agenda completa:',
    data.agendaLink,
    ...(variant.closing ? ['', variant.closing] : []),
  ]);

  return { subject: variant.subject, html, text };
}

/** Um evento novo entrou na agenda. */
export function eventCreatedEmail(
  data: EventAnnouncementEmailData,
): EmailContent {
  return renderEvent(data, {
    subject: EMAIL_SUBJECTS.eventCreated,
    title: 'Novo evento na agenda',
    intro: 'Guarde a data! Um novo evento acabou de entrar na agenda:',
    action: 'Ver na agenda',
  });
}

/** Um evento da agenda mudou. */
export function eventUpdatedEmail(
  data: EventAnnouncementEmailData,
): EmailContent {
  return renderEvent(data, {
    subject: EMAIL_SUBJECTS.eventUpdated,
    title: 'Evento atualizado',
    intro: 'Um evento da agenda foi atualizado. Confira como ficou:',
    action: 'Ver na agenda',
  });
}

/** Um evento saiu da agenda. */
export function eventCancelledEmail(
  data: EventAnnouncementEmailData,
): EmailContent {
  return renderEvent(data, {
    subject: EMAIL_SUBJECTS.eventCancelled,
    title: 'Evento cancelado',
    intro: 'Este evento saiu da agenda e não vai mais acontecer:',
    action: 'Ver a agenda',
    closing: 'Desculpe o transtorno.',
  });
}
