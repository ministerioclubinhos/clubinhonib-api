import { EMAIL_BRAND, EMAIL_SUBJECTS } from '../constants';
import { EmailContent } from '../types';
import { dataTable } from './blocks';
import {
  contactNotificationEmail,
  emailVerificationEmail,
  passwordChangedEmail,
  passwordRecoveryEmail,
  weekMaterialAnnouncementEmail,
  eventCreatedEmail,
  eventUpdatedEmail,
  eventCancelledEmail,
} from './index';

const LINK = 'https://clubinhonib.com/confirmar-email/abc123';

const allTemplates: { name: string; content: EmailContent }[] = [
  {
    name: 'recuperação de senha',
    content: passwordRecoveryEmail({ recipientName: 'Ana', resetLink: LINK }),
  },
  {
    name: 'senha alterada',
    content: passwordChangedEmail({ recipientName: 'Ana', loginLink: LINK }),
  },
  {
    name: 'confirmação de e-mail',
    content: emailVerificationEmail({
      recipientName: 'Ana',
      verificationLink: LINK,
    }),
  },
  {
    name: 'aviso de material da semana',
    content: weekMaterialAnnouncementEmail({
      title: 'Semana 12',
      subtitle: 'Tema da semana',
      description: 'Materiais da visita',
      materialLink: 'https://clubinhonib.com/materiais_semanal_semana-12',
    }),
  },
  {
    name: 'evento criado',
    content: eventCreatedEmail({
      title: 'Festa da Família',
      date: '2026-04-12',
      location: 'Salão da igreja',
      description: 'Traga a família toda.',
      agendaLink: 'https://clubinhonib.com/eventos',
    }),
  },
  {
    name: 'aviso de contato',
    content: contactNotificationEmail({
      name: 'Ana',
      email: 'ana@exemplo.com',
      phone: '(11) 98888-7777',
      message: 'Olá!',
      receivedAt: new Date('2026-03-10T12:00:00Z'),
    }),
  },
];

describe('templates de e-mail', () => {
  describe.each(allTemplates)('$name', ({ content }) => {
    it('devolve assunto, html e texto', () => {
      expect(content.subject.length).toBeGreaterThan(0);
      expect(content.html.length).toBeGreaterThan(0);
      expect(content.text.length).toBeGreaterThan(0);
    });

    it('usa a mesma casca', () => {
      expect(content.html).toContain('<!DOCTYPE html>');
      expect(content.html).toContain(EMAIL_BRAND.name);
      expect(content.html).toContain(EMAIL_BRAND.tagline);
      expect(content.html).toContain('prefers-color-scheme: dark');
    });

    it('não deixa marcador de template sem substituir', () => {
      expect(content.html).not.toContain('undefined');
      expect(content.text).not.toContain('undefined');
    });
  });

  it('cada e-mail tem o assunto declarado nas constantes', () => {
    expect(allTemplates[0].content.subject).toBe(
      EMAIL_SUBJECTS.passwordRecovery,
    );
    expect(allTemplates[1].content.subject).toBe(
      EMAIL_SUBJECTS.passwordChanged,
    );
    expect(allTemplates[2].content.subject).toBe(
      EMAIL_SUBJECTS.emailVerification,
    );
    expect(allTemplates[3].content.subject).toBe(
      EMAIL_SUBJECTS.weekMaterialAnnouncement,
    );
    expect(allTemplates[4].content.subject).toBe(EMAIL_SUBJECTS.eventCreated);
    expect(allTemplates[5].content.subject).toBe(
      EMAIL_SUBJECTS.contactNotification,
    );
  });

  describe('escape do conteúdo', () => {
    it('escapa o nome de quem recebe', () => {
      const { html } = passwordRecoveryEmail({
        recipientName: '<img src=x onerror=alert(1)>',
        resetLink: LINK,
      });

      expect(html).not.toContain('<img src=x');
      expect(html).toContain('&lt;img src=x');
    });

    it('escapa todos os campos do formulário público de contato', () => {
      // O formulário é aberto: sem escape, quem escreve escolhe o HTML que a
      // equipe abre na caixa de entrada.
      const { html } = contactNotificationEmail({
        name: '<b>Ana</b>',
        email: 'ana@exemplo.com"><script>alert(1)</script>',
        phone: '<i>11</i>',
        message: '<a href="https://phishing.example">Clique aqui</a>',
        receivedAt: new Date('2026-03-10T12:00:00Z'),
      });

      expect(html).not.toContain('<b>Ana</b>');
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('href="https://phishing.example"');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('links', () => {
    it('leva o link no botão, no texto de apoio e na versão texto', () => {
      const { html, text } = emailVerificationEmail({
        recipientName: 'Ana',
        verificationLink: LINK,
      });

      expect(html).toContain(`href="${LINK}"`);
      expect(html).toContain('Confirmar e-mail');
      expect(text).toContain(LINK);
    });

    it('não vira link quando a URL tem esquema perigoso', () => {
      const { html } = passwordRecoveryEmail({
        recipientName: 'Ana',
        resetLink: 'javascript:alert(1)',
      });

      expect(html).not.toContain('javascript:');
      expect(html).not.toContain('<a href');
    });
  });

  it('o aviso de material leva título e link, sem saudação por nome', () => {
    // O mesmo conteúdo vai para o lote inteiro em cópia oculta.
    const { html, text } = weekMaterialAnnouncementEmail({
      title: 'Semana 12',
      materialLink: 'https://clubinhonib.com/materiais_semanal_semana-12',
    });

    expect(html).toContain('Semana 12');
    expect(html).toContain(
      'href="https://clubinhonib.com/materiais_semanal_semana-12"',
    );
    expect(html).not.toContain('Olá,');
    expect(text).toContain('materiais_semanal_semana-12');
  });

  describe('avisos da agenda', () => {
    const event = {
      title: 'Festa da Família',
      date: '2026-04-12',
      location: 'Salão da igreja',
      description: 'Traga a família toda.',
      agendaLink: 'https://clubinhonib.com/eventos',
    };

    it('as três variações mostram os mesmos dados do evento', () => {
      for (const content of [
        eventCreatedEmail(event),
        eventUpdatedEmail(event),
        eventCancelledEmail(event),
      ]) {
        expect(content.html).toContain('Festa da Família');
        expect(content.html).toContain('12/04/2026');
        expect(content.html).toContain('Salão da igreja');
        expect(content.html).toContain(
          'href="https://clubinhonib.com/eventos"',
        );
      }
    });

    it('cada variação tem seu próprio assunto e título', () => {
      expect(eventCreatedEmail(event).subject).toBe(
        EMAIL_SUBJECTS.eventCreated,
      );
      expect(eventUpdatedEmail(event).subject).toBe(
        EMAIL_SUBJECTS.eventUpdated,
      );
      expect(eventCancelledEmail(event).subject).toBe(
        EMAIL_SUBJECTS.eventCancelled,
      );
      expect(eventCancelledEmail(event).html).toContain('Evento cancelado');
    });

    it('funciona sem descrição', () => {
      const { html } = eventCreatedEmail({ ...event, description: undefined });

      expect(html).toContain('Festa da Família');
      expect(html).not.toContain('Descrição');
    });

    it('escapa os campos do evento', () => {
      const { html } = eventCreatedEmail({
        ...event,
        title: '<script>alert(1)</script>',
      });

      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });
  });

  describe('linha de URL na tabela de dados', () => {
    it('vira link quando a URL é http(s)', () => {
      const html = dataTable([
        { label: 'Página', value: 'https://clubinhonib.com/a', as: 'url' },
      ]);

      expect(html).toContain('href="https://clubinhonib.com/a"');
    });

    it('fica só como texto quando o esquema é inesperado', () => {
      const html = dataTable([
        { label: 'Página', value: 'javascript:alert(1)', as: 'url' },
      ]);

      expect(html).not.toContain('href=');
      expect(html).toContain('javascript:alert(1)');
    });
  });

  it('o aviso de contato mostra os dados e a mensagem', () => {
    const { html, text } = contactNotificationEmail({
      name: 'Ana',
      email: 'ana@exemplo.com',
      phone: '(11) 98888-7777',
      message: 'Quero ajudar no clubinho.',
      receivedAt: new Date('2026-03-10T12:00:00Z'),
    });

    expect(html).toContain('mailto:ana@exemplo.com');
    expect(html).toContain('tel:11988887777');
    expect(html).toContain('Quero ajudar no clubinho.');
    expect(text).toContain('Quero ajudar no clubinho.');
  });
});
