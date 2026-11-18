import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, MissingPagelaReminderEmailData } from '../types';
import { formatEventDate, joinTextLines, unsubscribeTextLines } from '../utils';
import {
  button,
  composeBody,
  dataTable,
  heading,
  note,
  paragraph,
  quoteBlock,
} from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Pagelas pendentes da semana';

/**
 * Lembrete de pagela faltando, enviado no domingo aos professores e ao
 * coordenador do clubinho.
 *
 * Nomeia as crianças porque quem recebe já as acompanha toda semana — é a lista
 * de quem falta lançar, não uma divulgação. Esses nomes ficam no corpo do
 * e-mail e **nunca** no log.
 */
export function missingPagelaReminderEmail(
  data: MissingPagelaReminderEmailData,
): EmailContent {
  const intro =
    data.withPagela === 0
      ? `A semana fechou sem nenhuma pagela lançada no Clubinho ${data.clubNumber}.`
      : `A semana fechou com pagelas faltando no Clubinho ${data.clubNumber}.`;

  // Uma criança por linha: é uma lista para conferir, não um parágrafo.
  const childrenList = data.missing.map((child) => child.childName).join('\n');

  const html = renderEmailLayout({
    title: TITLE,
    body: composeBody([
      paragraph(intro),
      dataTable([
        { label: 'Clubinho', value: String(data.clubNumber) },
        {
          label: 'Semana',
          value: `${data.academicWeek} de ${data.academicYear}`,
        },
        ...(data.expectedDate
          ? [
              {
                label: 'Dia do clubinho',
                value: formatEventDate(data.expectedDate),
              },
            ]
          : []),
        {
          label: 'Pagelas lançadas',
          value: `${data.withPagela} de ${data.totalChildren}`,
        },
      ]),
      heading(
        data.missing.length === 1
          ? 'Criança sem pagela'
          : `Crianças sem pagela (${data.missing.length})`,
      ),
      quoteBlock(childrenList),
      button('Lançar as pagelas', data.pagelasLink),
      note('Ainda dá para lançar: a semana passada continua aberta no painel.'),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    TITLE,
    '',
    intro,
    '',
    `Clubinho: ${data.clubNumber}`,
    `Semana: ${data.academicWeek} de ${data.academicYear}`,
    ...(data.expectedDate
      ? [`Dia do clubinho: ${formatEventDate(data.expectedDate)}`]
      : []),
    `Pagelas lançadas: ${data.withPagela} de ${data.totalChildren}`,
    '',
    `Crianças sem pagela (${data.missing.length}):`,
    childrenList,
    '',
    'Lance por aqui:',
    data.pagelasLink,
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.missingPagelaReminder, html, text };
}
