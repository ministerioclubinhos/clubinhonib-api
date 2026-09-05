import { EMAIL_SUBJECTS } from '../constants';
import {
  CoordinatorSummaryClub,
  CoordinatorWeeklySummaryEmailData,
  EmailContent,
} from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import {
  button,
  composeBody,
  dataTable,
  heading,
  note,
  paragraph,
} from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Resumo da semana dos seus clubinhos';

/** Uma linha por clubinho: número, situação e quanto falta. */
function clubLine(club: CoordinatorSummaryClub): string {
  const counted = `${club.withPagela} de ${club.totalChildren} pagelas`;
  return club.missing > 0
    ? `${club.status} — ${counted}, ${club.missing} faltando`
    : `${club.status} — ${counted}`;
}

/**
 * Resumo de segunda-feira para um coordenador, com os clubinhos dele.
 *
 * Só os clubinhos com pendência entram na tabela; os que fecharam a semana
 * inteira viram um número no fim. Uma tabela com trinta linhas verdes esconde
 * as três que precisam de atenção.
 */
export function coordinatorWeeklySummaryEmail(
  data: CoordinatorWeeklySummaryEmailData,
): EmailContent {
  const week = `Semana ${data.academicWeek} de ${data.academicYear}`;
  const allDone = data.clubs.length === 0;
  const intro = allDone
    ? `${week}: todos os seus clubinhos fecharam a semana com as pagelas em dia.`
    : `${week}: estes clubinhos fecharam a semana com pendência.`;
  const closing = `${data.clubsOk} clubinho(s) seu(s) fecharam a semana sem pendência.`;

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph(intro),
      ...(allDone
        ? []
        : [
            heading('Clubinhos com pendência'),
            dataTable(
              data.clubs.map((club) => ({
                label: `Clubinho ${club.clubNumber}`,
                value: clubLine(club),
              })),
            ),
          ]),
      button('Abrir o painel de controle', data.panelLink),
      note(closing),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    intro,
    ...(allDone
      ? []
      : [
          '',
          ...data.clubs.map(
            (club) => `Clubinho ${club.clubNumber}: ${clubLine(club)}`,
          ),
        ]),
    '',
    'Abra o painel:',
    data.panelLink,
    '',
    closing,
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.coordinatorWeeklySummary, html, text };
}
