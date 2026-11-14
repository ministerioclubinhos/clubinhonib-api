import { EMAIL_SUBJECTS } from '../constants';
import { siteFeedbackNotificationEmail } from './site-feedback-notification.template';

const data = {
  name: 'Ana',
  email: 'ana@exemplo.com',
  rating: 4,
  maxRating: 5,
  category: 'Facilidade de uso',
  comment: 'Site muito bom, mas o menu confunde.',
  receivedAt: new Date('2026-03-10T12:00:00Z'),
};

describe('aviso de avaliação do site', () => {
  it('usa o assunto declarado nas constantes', () => {
    expect(siteFeedbackNotificationEmail(data).subject).toBe(
      EMAIL_SUBJECTS.siteFeedbackNotification,
    );
  });

  it('mostra nota, categoria, autor e comentário', () => {
    const { html, text } = siteFeedbackNotificationEmail(data);

    expect(html).toContain('4 de 5');
    expect(html).toContain('Facilidade de uso');
    expect(html).toContain('Ana');
    expect(html).toContain('mailto:ana@exemplo.com');
    expect(html).toContain('Site muito bom, mas o menu confunde.');
    // HTML e texto saem da mesma linha, então as estrelas vão nos dois.
    expect(text).toContain('Nota: ★★★★☆  4 de 5');
    expect(text).toContain('Site muito bom, mas o menu confunde.');
  });

  it('desenha a nota em estrelas', () => {
    expect(siteFeedbackNotificationEmail(data).html).toContain('★★★★☆');
    expect(
      siteFeedbackNotificationEmail({ ...data, rating: 0 }).html,
    ).toContain('☆☆☆☆☆');
    expect(
      siteFeedbackNotificationEmail({ ...data, rating: 5 }).html,
    ).toContain('★★★★★');
  });

  it('não quebra com nota fora da escala', () => {
    // O formulário é público: uma nota inesperada não pode gerar HTML estranho.
    const { html } = siteFeedbackNotificationEmail({ ...data, rating: 9 });

    expect(html).toContain('★★★★★');
    expect(html).not.toContain('undefined');
  });

  it('funciona sem e-mail, que é opcional no formulário', () => {
    const { html, text } = siteFeedbackNotificationEmail({
      ...data,
      email: undefined,
    });

    expect(html).not.toContain('mailto:');
    expect(text).not.toContain('E-mail:');
  });

  it('escapa o conteúdo, que vem de formulário público', () => {
    const { html } = siteFeedbackNotificationEmail({
      ...data,
      name: '<script>alert(1)</script>',
      comment: '<a href="https://phishing.example">clique</a>',
    });

    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="https://phishing.example"');
    expect(html).toContain('&lt;script&gt;');
  });
});
