import { EMAIL_SUBJECTS } from '../constants';
import { ClubDayCancelledEmailData, EmailContent } from '../types';
import { formatEventDate, joinTextLines, unsubscribeTextLines } from '../utils';
import {
  composeBody,
  dataTable,
  heading,
  note,
  paragraph,
  quoteBlock,
} from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Neste dia não vai ter Clubinho';

/**
 * Aviso de que uma data não terá Clubinho.
 *
 * A exceção é global por data, então vale para todos os clubinhos que se
 * reúnem naquele dia da semana — e é por isso que o aviso vai para toda a base,
 * e não só para um clube.
 *
 * O texto não diz "feriado": a exceção tem cinco motivos possíveis, e feriado é
 * só um deles. O motivo cadastrado é que aparece.
 */
export function clubDayCancelledEmail(
  data: ClubDayCancelledEmailData,
): EmailContent {
  const recurrent = 'Esta data se repete todo ano.';

  const html = renderEmailLayout({
    title: TITLE,
    body: composeBody([
      paragraph(
        'A coordenação avisou que não haverá Clubinho na data abaixo. Não é preciso lançar pagela dessa semana.',
      ),
      dataTable([
        { label: 'Data', value: formatEventDate(data.date) },
        { label: 'Motivo', value: data.reason },
      ]),
      ...(data.notes ? [heading('Observação'), quoteBlock(data.notes)] : []),
      data.isRecurrent ? note(recurrent) : '',
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    TITLE,
    '',
    'A coordenação avisou que não haverá Clubinho na data abaixo. Não é preciso lançar pagela dessa semana.',
    '',
    `Data: ${formatEventDate(data.date)}`,
    `Motivo: ${data.reason}`,
    ...(data.notes ? ['', 'Observação:', data.notes] : []),
    ...(data.isRecurrent ? ['', recurrent] : []),
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.clubDayCancelled, html, text };
}
