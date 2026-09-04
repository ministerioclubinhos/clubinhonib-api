import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmtpService } from 'src/shared/providers/smtp/smtp.service';
import { SiteUrlService } from 'src/shared/site-url/site-url.service';
import { EMAIL_SUBJECTS, UNSUBSCRIBE_FOOTER } from './constants';
import { EmailService } from './email.service';
import { EmailRecipient } from './types';
import { UnsubscribeTokenService } from './unsubscribe-token.service';

describe('EmailService', () => {
  const smtpService = { sendMail: jest.fn() };
  const config: Record<string, string> = {
    MAIL_CONTACT_TO: 'equipe@clubinhonib.com, coordenacao@clubinhonib.com',
    EMAIL_UNSUBSCRIBE_SECRET: 'segredo-de-teste',
  };
  const configService = { get: (key: string) => config[key] };
  const siteUrlService = { baseUrl: 'https://clubinhonib.com' };

  const recipient = (index = 0): EmailRecipient => ({
    id: `user-${index}`,
    name: `Pessoa ${index}`,
    email: `user${index}@exemplo.com`,
  });

  const recipients = (total: number): EmailRecipient[] =>
    Array.from({ length: total }, (_, index) => recipient(index));

  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    config.MAIL_CONTACT_TO =
      'equipe@clubinhonib.com, coordenacao@clubinhonib.com';

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        UnsubscribeTokenService,
        { provide: SmtpService, useValue: smtpService },
        { provide: SiteUrlService, useValue: siteUrlService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(EmailService);
  });

  it('envia a recuperação de senha com assunto, html e texto', async () => {
    await service.sendPasswordRecovery(
      { id: 'user-1', name: 'Ana', email: 'ana@exemplo.com' },
      {
        recipientName: 'Ana',
        resetLink: 'https://clubinhonib.com/recuperar-senha/abc',
      },
    );

    expect(smtpService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'ana@exemplo.com',
        subject: EMAIL_SUBJECTS.passwordRecovery,
        html: expect.stringContaining('<!DOCTYPE html>') as string,
        text: expect.stringContaining('recuperar-senha') as string,
      }),
    );
  });

  it('envia o aviso de senha alterada', async () => {
    await service.sendPasswordChanged(
      { id: 'user-1', name: 'Ana', email: 'ana@exemplo.com' },
      { recipientName: 'Ana', loginLink: 'https://clubinhonib.com' },
    );

    expect(smtpService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: EMAIL_SUBJECTS.passwordChanged }),
    );
  });

  it('envia a confirmação de e-mail', async () => {
    await service.sendEmailVerification(
      { id: 'user-1', name: 'Ana', email: 'ana@exemplo.com' },
      {
        recipientName: 'Ana',
        verificationLink: 'https://clubinhonib.com/confirmar-email/abc',
      },
    );

    expect(smtpService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: EMAIL_SUBJECTS.emailVerification }),
    );
  });

  describe('aviso de novo material da semana', () => {
    const data = {
      title: 'Semana 12',
      subtitle: 'Tema',
      description: 'Materiais',
      materialLink: 'https://clubinhonib.com/materiais_semanal_semana-12',
    };

    /**
     * Antes ia em lotes com os endereços em cópia oculta. O rodapé precisa
     * levar o token de quem recebe, e um token só serve para uma pessoa.
     */
    it('manda uma mensagem por pessoa, sem cópia oculta', async () => {
      await service.sendWeekMaterialAnnouncement(recipients(3), data);

      expect(smtpService.sendMail).toHaveBeenCalledTimes(3);

      const calls = smtpService.sendMail.mock.calls as [
        { to: string; bcc?: unknown },
      ][];
      for (const [sent] of calls) {
        expect(sent.bcc).toBeUndefined();
        expect(typeof sent.to).toBe('string');
      }
    });

    it('dá a cada pessoa um link de descadastro diferente', async () => {
      await service.sendWeekMaterialAnnouncement(recipients(2), data);

      const [[first], [second]] = smtpService.sendMail.mock.calls as [
        [{ html: string }],
        [{ html: string }],
      ];

      expect(first.html).toContain(UNSUBSCRIBE_FOOTER.action);
      expect(first.html).toContain('/descadastrar?token=');
      expect(first.html).not.toEqual(second.html);
    });

    it('conta os envios, um por destinatário', async () => {
      const result = await service.sendWeekMaterialAnnouncement(
        recipients(120),
        data,
      );

      expect(smtpService.sendMail).toHaveBeenCalledTimes(120);
      expect(result).toEqual({ recipients: 120, sent: 120, failed: 0 });
    });

    it('remove endereços repetidos antes de enviar', async () => {
      const result = await service.sendWeekMaterialAnnouncement(
        [
          { id: 'a', name: 'Ana', email: 'ana@exemplo.com' },
          { id: 'a', name: 'Ana', email: ' ana@exemplo.com ' },
          { id: 'b', name: 'Bia', email: 'bia@exemplo.com' },
          { id: 'c', name: 'Cida', email: '' },
        ],
        data,
      );

      expect(result.recipients).toBe(2);
    });

    it('segue com os outros quando um envio falha', async () => {
      smtpService.sendMail
        .mockRejectedValueOnce(new Error('limite diário'))
        .mockResolvedValue(undefined);

      const result = await service.sendWeekMaterialAnnouncement(
        recipients(3),
        data,
      );

      expect(smtpService.sendMail).toHaveBeenCalledTimes(3);
      expect(result.sent).toBe(2);
      expect(result.failed).toBe(1);
    });

    it('não envia nada sem destinatário', async () => {
      const result = await service.sendWeekMaterialAnnouncement([], data);

      expect(smtpService.sendMail).not.toHaveBeenCalled();
      expect(result.recipients).toBe(0);
    });
  });

  describe('aviso de avaliação do site', () => {
    const feedback = {
      name: 'Ana',
      email: 'ana@exemplo.com',
      rating: 4,
      maxRating: 5,
      category: 'Facilidade de uso',
      comment: 'Site muito bom.',
      receivedAt: new Date('2026-03-10T12:00:00Z'),
    };

    it('envia para os administradores recebidos', async () => {
      await service.sendSiteFeedbackNotification(
        ['admin1@exemplo.com', 'admin2@exemplo.com'],
        feedback,
      );

      expect(smtpService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['admin1@exemplo.com', 'admin2@exemplo.com'],
          subject: EMAIL_SUBJECTS.siteFeedbackNotification,
          replyTo: 'ana@exemplo.com',
        }),
      );
    });

    it('não envia quando não há administrador cadastrado', async () => {
      await service.sendSiteFeedbackNotification([], feedback);

      expect(smtpService.sendMail).not.toHaveBeenCalled();
    });

    it('envia sem responder para ninguém quando a avaliação não tem e-mail', async () => {
      await service.sendSiteFeedbackNotification(['admin@exemplo.com'], {
        ...feedback,
        email: undefined,
      });

      const [[sent]] = smtpService.sendMail.mock.calls as [
        [{ replyTo?: string }],
      ];
      expect(sent.replyTo).toBeUndefined();
    });
  });

  describe('aviso de contato', () => {
    const contact = {
      name: 'Ana',
      email: 'ana@exemplo.com',
      phone: '(11) 98888-7777',
      message: 'Olá!',
      receivedAt: new Date('2026-03-10T12:00:00Z'),
    };
    const admins = ['admin1@exemplo.com', 'admin2@exemplo.com'];

    it('vai para os administradores informados', async () => {
      await service.sendContactNotification(admins, contact);

      expect(smtpService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['admin1@exemplo.com', 'admin2@exemplo.com'],
          subject: EMAIL_SUBJECTS.contactNotification,
        }),
      );
    });

    it('responde para quem escreveu, não para o remetente técnico', async () => {
      await service.sendContactNotification(admins, contact);

      expect(smtpService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ replyTo: 'ana@exemplo.com' }),
      );
    });

    it('não envia quando a lista de administradores está vazia', async () => {
      await service.sendContactNotification([], contact);

      expect(smtpService.sendMail).not.toHaveBeenCalled();
    });
  });
});
