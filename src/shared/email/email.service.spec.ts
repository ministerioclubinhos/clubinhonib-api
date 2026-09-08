import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { SmtpService } from 'src/shared/providers/smtp/smtp.service';
import { SiteUrlService } from 'src/shared/site-url/site-url.service';
import {
  EMAIL_NOTIFICATIONS_FOR_INACTIVE,
  EMAIL_SUBJECTS,
  UNSUBSCRIBE_FOOTER,
} from './constants';
import { EmailService } from './email.service';
import { EmailNotification, EmailRecipient } from './types';
import { UnsubscribeTokenService } from './unsubscribe-token.service';

describe('EmailService', () => {
  const smtpService = { sendMail: jest.fn() };
  const config: Record<string, string> = {
    MAIL_CONTACT_TO: 'equipe@clubinhonib.com, coordenacao@clubinhonib.com',
    EMAIL_UNSUBSCRIBE_SECRET: 'segredo-de-teste',
  };
  const configService = { get: (key: string) => config[key] };
  const siteUrlService = { baseUrl: 'https://clubinhonib.com' };

  /** Toda flag ligada; a suíte de bloqueio abaixo é quem desliga. */
  const featureFlags = { isSwitchedOn: jest.fn().mockResolvedValue(true) };

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
    featureFlags.isSwitchedOn.mockResolvedValue(true);
    config.MAIL_CONTACT_TO =
      'equipe@clubinhonib.com, coordenacao@clubinhonib.com';

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        UnsubscribeTokenService,
        { provide: SmtpService, useValue: smtpService },
        { provide: SiteUrlService, useValue: siteUrlService },
        { provide: ConfigService, useValue: configService },
        { provide: GetFeatureFlagsService, useValue: featureFlags },
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

  /**
   * Falha de envio não derruba fluxo. Em nenhum e-mail.
   *
   * O provedor de e-mail sai do ar, estoura o limite diário, recusa o
   * destinatário — e nada disso pode virar erro para quem estava criando uma
   * conta, trocando a senha ou publicando um material. O e-mail é sempre o
   * passo seguinte, nunca o produto da operação.
   *
   * A garantia mora em `dispatch`/`dispatchBulk`, por onde todo envio passa.
   * O teste percorre os métodos públicos por reflexão: um envio novo que não
   * use esse caminho aparece aqui, e um método que fuja da lista também.
   */
  describe('resiliência: o envio nunca derruba quem chamou', () => {
    type FormaDoPrimeiroArgumento =
      | 'destinatario'
      | 'destinatarios'
      | 'emails'
      | 'email';

    const FORMA_POR_METODO: Record<string, FormaDoPrimeiroArgumento> = {
      sendPasswordRecovery: 'destinatario',
      sendPasswordChanged: 'destinatario',
      sendEmailVerification: 'destinatario',
      sendAccountApproved: 'destinatario',
      sendRoleChanged: 'destinatario',
      sendAccountDeactivated: 'destinatario',
      sendAccountCreatedByAdmin: 'destinatario',
      sendCoordinatorWeeklySummary: 'destinatario',
      sendWeekMaterialAnnouncement: 'destinatarios',
      sendEventCreated: 'destinatarios',
      sendEventUpdated: 'destinatarios',
      sendEventCancelled: 'destinatarios',
      sendInformativePublished: 'destinatarios',
      sendDocumentPublished: 'destinatarios',
      sendClubDayCancelled: 'destinatarios',
      sendMissingPagelaReminder: 'destinatarios',
      sendAcceptedChristRegistered: 'destinatarios',
      sendContactNotification: 'emails',
      sendCommentNotification: 'emails',
      sendSiteFeedbackNotification: 'emails',
      sendIdeaSharedNotification: 'emails',
      sendImageSharedNotification: 'emails',
      sendNewUserRegistrationNotification: 'emails',
      sendEmailAddressChanged: 'email',
      sendAccountDeleted: 'email',
      sendContactReceipt: 'email',
    };

    const destinatario = {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@exemplo.com',
    };

    const primeiroArgumento = (forma: FormaDoPrimeiroArgumento): unknown => {
      if (forma === 'destinatario') return destinatario;
      if (forma === 'destinatarios') return [destinatario];
      if (forma === 'emails') return ['ana@exemplo.com'];
      return 'ana@exemplo.com';
    };

    /** Um objeto largo o bastante para qualquer template montar o corpo. */
    const dados = {
      recipientName: 'Ana',
      name: 'Ana',
      email: 'ana@exemplo.com',
      title: 'Assunto',
      subtitle: 'Sub',
      description: 'Descrição',
      message: 'Mensagem',
      reason: 'Motivo',
      date: '2026-04-12',
      location: 'Salão',
      loginLink: 'https://clubinhonib.com',
      resetLink: 'https://clubinhonib.com/recuperar-senha/abc',
      verificationLink: 'https://clubinhonib.com/confirmar-email/abc',
      materialLink: 'https://clubinhonib.com/materiais',
      agendaLink: 'https://clubinhonib.com/eventos',
      documentLink: 'https://clubinhonib.com/documentos',
      informativeLink: 'https://clubinhonib.com/informativos',
      link: 'https://clubinhonib.com',
      previousRole: 'teacher',
      newRole: 'coordinator',
      role: 'coordinator',
      clubs: [],
      clubNumber: 12,
      weeks: [],
      items: [],
      people: [],
      isRecurrent: false,
      temporaryPassword: 'senha-temporaria',
      phone: '11999999999',
      subject: 'Assunto',
      comment: 'Comentário',
      notes: 'Observações',
    };

    /**
     * Auxiliares internos do serviço.
     *
     * `private` do TypeScript não sobrevive até a execução, então a reflexão
     * enxerga estes junto dos envios públicos. A lista é curta e explícita de
     * propósito: um método novo que não esteja aqui nem no mapa acima reprova o
     * teste, que é exatamente o alarme que se quer.
     */
    const AUXILIARES_INTERNOS = ['send', 'sendToEach'];

    const metodosDeEnvio = (): string[] =>
      Object.getOwnPropertyNames(
        Object.getPrototypeOf(service) as object,
      ).filter(
        (nome) =>
          nome.startsWith('send') && !AUXILIARES_INTERNOS.includes(nome),
      );

    beforeEach(() => {
      // O erro real que motivou isto: limite diário do provedor estourado.
      smtpService.sendMail.mockRejectedValue(
        new Error('550 5.4.5 Daily user sending limit exceeded'),
      );
    });

    it('a lista cobre todos os envios públicos do serviço', () => {
      // Um envio novo entra aqui de propósito: sem isso, ele passaria sem
      // nunca ter sido verificado contra a queda do provedor.
      expect(metodosDeEnvio().sort()).toEqual(
        Object.keys(FORMA_POR_METODO).sort(),
      );
    });

    it.each(Object.keys(FORMA_POR_METODO))(
      '%s não lança quando o provedor recusa',
      async (metodo) => {
        const enviar = (
          service as unknown as Record<
            string,
            (...args: unknown[]) => Promise<unknown>
          >
        )[metodo];

        await expect(
          enviar.call(
            service,
            primeiroArgumento(FORMA_POR_METODO[metodo]),
            dados,
          ),
        ).resolves.not.toThrow();
      },
    );

    it('a confirmação de e-mail avisa que não saiu, em vez de estourar', async () => {
      // É o único envio cujo resultado o fluxo precisa saber: a tela conta ao
      // usuário se ele deve pedir o reenvio.
      await expect(
        service.sendEmailVerification(destinatario, {
          recipientName: 'Ana',
          verificationLink: 'https://clubinhonib.com/confirmar-email/abc',
        }),
      ).resolves.toBe(false);
    });

    it('o envio em massa conta a falha por destinatário, sem lançar', async () => {
      // O laço em massa já tratava destinatário a destinatário: um endereço
      // recusado não impede os outros e não vira erro para quem chamou.
      await expect(
        service.sendEventCreated([destinatario], {
          title: 'Festa',
          date: '2026-04-12',
          location: 'Salão',
          description: 'Descrição',
          agendaLink: 'https://clubinhonib.com/eventos',
        }),
      ).resolves.toEqual({ recipients: 1, sent: 0, failed: 1 });
    });
  });

  /**
   * Aviso só vai para conta ativa — salvo as exceções declaradas.
   *
   * A régua das listas já vive no `core/user` (`findActiveRecipients`,
   * `findNoticeRecipientsByIds`). Estes testes cobrem o outro caminho: o envio
   * endereçado a **uma** pessoa, onde o destinatário é montado a partir da
   * entidade e nada consultava a situação da conta.
   */
  describe('conta inativa', () => {
    const inativo = {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@exemplo.com',
      active: false,
    };
    const ativo = { ...inativo, active: true };

    it('não recebe aviso de conta: o papel mudou', async () => {
      await service.sendRoleChanged(inativo, {
        recipientName: 'Ana',
        previousRole: 'Professor',
        currentRole: 'Coordenador',
        loginLink: 'https://clubinhonib.com',
      });

      expect(smtpService.sendMail).not.toHaveBeenCalled();
    });

    it('não recebe o resumo semanal do coordenador', async () => {
      await service.sendCoordinatorWeeklySummary(inativo, {
        recipientName: 'Ana',
        academicWeek: 12,
        academicYear: 2026,
        clubs: [],
        clubsOk: 0,
        panelLink: 'https://clubinhonib.com/adm',
      });

      expect(smtpService.sendMail).not.toHaveBeenCalled();
    });

    it('a mesma notificação sai normalmente para conta ativa', async () => {
      await service.sendRoleChanged(ativo, {
        recipientName: 'Ana',
        previousRole: 'Professor',
        currentRole: 'Coordenador',
        loginLink: 'https://clubinhonib.com',
      });

      expect(smtpService.sendMail).toHaveBeenCalledTimes(1);
    });

    it('sem situação conhecida, não há o que barrar', async () => {
      // É o caso das listas em massa: elas já chegam filtradas pelo core/user.
      const semSituacao = {
        id: inativo.id,
        name: inativo.name,
        email: inativo.email,
      };

      await service.sendRoleChanged(semSituacao, {
        recipientName: 'Ana',
        previousRole: 'Professor',
        currentRole: 'Coordenador',
        loginLink: 'https://clubinhonib.com',
      });

      expect(smtpService.sendMail).toHaveBeenCalledTimes(1);
    });

    describe('exceções: o que sai mesmo com a conta inativa', () => {
      it('a lista de exceções é exatamente esta', () => {
        // Prende a lista de propósito. Cada item aqui é um e-mail que chega a
        // quem já não deveria receber nada, e ampliá-la sem querer é fácil:
        // basta um envio novo entrar na constante junto dos outros.
        expect([...EMAIL_NOTIFICATIONS_FOR_INACTIVE].sort()).toEqual(
          [
            EmailNotification.AccountCreatedByAdmin,
            EmailNotification.AccountDeactivated,
            EmailNotification.AccountDeleted,
            EmailNotification.ContactReceipt,
            EmailNotification.EmailAddressChanged,
            EmailNotification.EmailVerification,
            EmailNotification.PasswordChanged,
            EmailNotification.PasswordRecovery,
          ].sort(),
        );
      });

      it('a confirmação de e-mail — é ela que ativa a conta', async () => {
        await service.sendEmailVerification(inativo, {
          recipientName: 'Ana',
          verificationLink: 'https://clubinhonib.com/confirmar-email/abc',
        });

        expect(smtpService.sendMail).toHaveBeenCalledTimes(1);
      });

      it('a recuperação de senha — sem ela, quem não confirmou fica preso', async () => {
        await service.sendPasswordRecovery(inativo, {
          recipientName: 'Ana',
          resetLink: 'https://clubinhonib.com/recuperar-senha/abc',
        });

        expect(smtpService.sendMail).toHaveBeenCalledTimes(1);
      });

      it('o aviso de senha alterada — é aviso de segurança da conta', async () => {
        await service.sendPasswordChanged(inativo, {
          recipientName: 'Ana',
          loginLink: 'https://clubinhonib.com',
        });

        expect(smtpService.sendMail).toHaveBeenCalledTimes(1);
      });

      it('o aviso de conta desativada — é sobre a desativação', async () => {
        await service.sendAccountDeactivated(inativo, {
          recipientName: 'Ana',
        });

        expect(smtpService.sendMail).toHaveBeenCalledTimes(1);
      });

      it('a conta criada pelo admin — ela nasce sem confirmação', async () => {
        await service.sendAccountCreatedByAdmin(inativo, {
          recipientName: 'Ana',
          role: 'Coordenador',
          passwordSetupLink: 'https://clubinhonib.com/recuperar-senha/abc',
          validityHours: 24,
        });

        expect(smtpService.sendMail).toHaveBeenCalledTimes(1);
      });
    });
  });
});
