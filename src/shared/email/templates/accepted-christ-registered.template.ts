import { EMAIL_SUBJECTS } from '../constants';
import { AcceptedChristRegisteredEmailData, EmailContent } from '../types';
import {
  formatBrazilianDateTime,
  joinTextLines,
  unsubscribeTextLines,
} from '../utils';
import { button, composeBody, dataTable, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Uma criança tomou uma decisão';

/**
 * Aviso de decisão por Cristo registrada, para o coordenador e os professores
 * do clubinho da criança.
 *
 * O nome da criança vai no corpo porque quem recebe já a acompanha; o
 * `notes` de quem registrou **não** entra — é uma observação pastoral escrita
 * para o prontuário, não para uma lista de destinatários.
 */
export function acceptedChristRegisteredEmail(
  data: AcceptedChristRegisteredEmailData,
): EmailContent {
  const html = renderEmailLayout({
    title: TITLE,
    body: composeBody([
      paragraph(
        `Uma decisão foi registrada no Clubinho ${data.clubNumber}. Vale acompanhar de perto nas próximas semanas.`,
      ),
      dataTable([
        { label: 'Criança', value: data.childName },
        { label: 'Clubinho', value: String(data.clubNumber) },
        { label: 'Decisão', value: data.decision },
        {
          label: 'Registrada em',
          value: formatBrazilianDateTime(data.registeredAt),
        },
      ]),
      data.panelLink ? button('Ver no painel', data.panelLink) : '',
      note('Que alegria. Continuem orando por ela.'),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    TITLE,
    '',
    `Uma decisão foi registrada no Clubinho ${data.clubNumber}. Vale acompanhar de perto nas próximas semanas.`,
    '',
    `Criança: ${data.childName}`,
    `Clubinho: ${data.clubNumber}`,
    `Decisão: ${data.decision}`,
    `Registrada em: ${formatBrazilianDateTime(data.registeredAt)}`,
    ...(data.panelLink ? ['', data.panelLink] : []),
    '',
    'Que alegria. Continuem orando por ela.',
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.acceptedChristRegistered, html, text };
}
