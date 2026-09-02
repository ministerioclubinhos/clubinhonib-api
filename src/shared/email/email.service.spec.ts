import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SmtpService } from 'src/shared/providers/smtp/smtp.service';
import { EMAIL_SUBJECTS } from './constants';
import { EmailService } from './email.service';

describe('EmailService', () => {
  const smtpService = { sendMail: jest.fn() };
  const config: Record<string, string> = {
    MAIL_CONTACT_TO: 'equipe@clubinhonib.com, coordenacao@clubinhonib.com',
  };
  const configService = { get: (key: string) => config[key] };

  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();
    config.MAIL_CONTACT_TO =
      'equipe@clubinhonib.com, coordenacao@clubinhonib.com';

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: SmtpService, useValue: smtpService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = moduleRef.get(EmailService);
  });

  it('envia a recuperação de senha com assunto, html e texto', async () => {
    await service.sendPasswordRecovery('ana@exemplo.com', {
      recipientName: 'Ana',
      resetLink: 'https://clubinhonib.com/recuperar-senha/abc',
    });

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
    await service.sendPasswordChanged('ana@exemplo.com', {
      recipientName: 'Ana',
      loginLink: 'https://clubinhonib.com',
    });

    expect(smtpService.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: EMAIL_SUBJECTS.passwordChanged }),
    );
  });

  it('envia a confirmação de e-mail', async () => {
    await service.sendEmailVerification('ana@exemplo.com', {
      recipientName: 'Ana',
      verificationLink: 'https://clubinhonib.com/confirmar-email/abc',
    });

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

    const emails = (total: number): string[] =>
      Array.from({ length: total }, (_, index) => `user${index}@exemplo.com`);

    it('manda os endereços em cópia oculta, nunca no para', async () => {
      // Sem isso, cada pessoa receberia a lista de e-mails de todas as outras.
      await service.sendWeekMaterialAnnouncement(emails(3), data);

      const [[sent]] = smtpService.sendMail.mock.calls as [
        [{ to?: unknown; bcc: string[] }],
      ];
      expect(sent.to).toBeUndefined();
      expect(sent.bcc).toHaveLength(3);
    });

    it('divide em lotes de 50', async () => {
      const result = await service.sendWeekMaterialAnnouncement(
        emails(120),
        data,
      );

      expect(smtpService.sendMail).toHaveBeenCalledTimes(3);
      expect(result).toEqual({
        recipients: 120,
        batchesSent: 3,
        batchesFailed: 0,
      });
    });

    it('remove endereços repetidos antes de enviar', async () => {
      const result = await service.sendWeekMaterialAnnouncement(
        ['ana@exemplo.com', ' ana@exemplo.com ', 'bia@exemplo.com', ''],
        data,
      );

      expect(result.recipients).toBe(2);
    });

    it('segue com os outros lotes quando um falha', async () => {
      smtpService.sendMail
        .mockRejectedValueOnce(new Error('limite diário'))
        .mockResolvedValue(undefined);

      const result = await service.sendWeekMaterialAnnouncement(
        emails(120),
        data,
      );

      expect(smtpService.sendMail).toHaveBeenCalledTimes(3);
      expect(result.batchesSent).toBe(2);
      expect(result.batchesFailed).toBe(1);
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
