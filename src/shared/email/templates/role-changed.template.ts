import { EMAIL_SUBJECTS } from '../constants';
import { EmailContent, RoleChangedEmailData } from '../types';
import { joinTextLines, unsubscribeTextLines } from '../utils';
import { button, composeBody, dataTable, note, paragraph } from './blocks';
import { renderEmailLayout } from './layout';

const TITLE = 'Seu papel na plataforma mudou';

/**
 * Aviso de mudança de papel.
 *
 * Diz explicitamente que o vínculo com o clubinho se desfez, porque é isso que
 * a pessoa nota primeiro: o papel novo traz um perfil novo, e o clubinho antigo
 * some da tela sem explicação nenhuma.
 */
export function roleChangedEmail(data: RoleChangedEmailData): EmailContent {
  const unlinked =
    'A troca de papel desfez seu vínculo com o clubinho anterior. Se você continua acompanhando um clubinho, peça à coordenação para refazer o vínculo.';

  const html = renderEmailLayout({
    title: TITLE,
    recipientName: data.recipientName,
    body: composeBody([
      paragraph('A coordenação alterou seu papel na plataforma.'),
      dataTable([
        { label: 'Papel anterior', value: data.previousRole },
        { label: 'Papel atual', value: data.currentRole },
      ]),
      paragraph(
        'O que você enxerga na plataforma muda junto: entre de novo para ver as telas do papel novo.',
      ),
      button('Entrar na plataforma', data.loginLink),
      note(unlinked),
    ]),
    unsubscribeUrl: data.unsubscribeUrl,
  });

  const text = joinTextLines([
    `Olá, ${data.recipientName}!`,
    '',
    'A coordenação alterou seu papel na plataforma.',
    '',
    `Papel anterior: ${data.previousRole}`,
    `Papel atual: ${data.currentRole}`,
    '',
    'O que você enxerga na plataforma muda junto: entre de novo para ver as telas do papel novo.',
    data.loginLink,
    '',
    unlinked,
    ...unsubscribeTextLines(data.unsubscribeUrl),
  ]);

  return { subject: EMAIL_SUBJECTS.roleChanged, html, text };
}
