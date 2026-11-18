import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { DEFAULT_FEATURE_FLAGS } from 'src/core/feature-flags/constants';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { SmtpService } from 'src/shared/providers/smtp/smtp.service';
import { SiteUrlService } from 'src/shared/site-url/site-url.service';

import { EMAIL_NOTIFICATION_FLAGS } from './constants';
import { EmailService } from './email.service';
import { EmailNotification, EmailRecipient } from './types';
import { UnsubscribeTokenService } from './unsubscribe-token.service';

/**
 * O contrato: **toda** notificação por e-mail passa por uma feature flag
 * própria, e desligar a flag impede o envio.
 *
 * Esta suíte existe para a regra sobreviver ao próximo e-mail. Um método de
 * envio novo que não passe pelo funil da flag reprova aqui, mesmo que quem o
 * escreveu nunca tenha lido a documentação.
 */

const recipient: EmailRecipient = {
  id: 'user-1',
  name: 'Ana',
  email: 'ana@exemplo.com',
};

const NOW = new Date('2026-04-12T18:30:00Z');
const LINK = 'https://clubinhonib.com/exemplo';

/**
 * Como disparar cada notificação. Uma entrada por valor de `EmailNotification`
 * — o `Record` cobra a entrada que faltar em tempo de compilação.
 */
const DISPATCHERS: Record<
  EmailNotification,
  { method: string; call: (service: EmailService) => Promise<unknown> }
> = {
  [EmailNotification.FeedPhotoCommentRejected]: {
    method: 'sendFeedPhotoCommentRejected',
    call: (s) =>
      s.sendFeedPhotoCommentRejected(recipient, {
        recipientName: 'Ana',
        commentText: 'Meu comentário',
        reason: 'Dados pessoais',
        feedLink: LINK,
      }),
  },
  [EmailNotification.PasswordRecovery]: {
    method: 'sendPasswordRecovery',
    call: (s) =>
      s.sendPasswordRecovery(recipient, {
        recipientName: 'Ana',
        resetLink: LINK,
      }),
  },
  [EmailNotification.PasswordChanged]: {
    method: 'sendPasswordChanged',
    call: (s) =>
      s.sendPasswordChanged(recipient, {
        recipientName: 'Ana',
        loginLink: LINK,
      }),
  },
  [EmailNotification.EmailVerification]: {
    method: 'sendEmailVerification',
    call: (s) =>
      s.sendEmailVerification(recipient, {
        recipientName: 'Ana',
        verificationLink: LINK,
      }),
  },
  [EmailNotification.ContactNotification]: {
    method: 'sendContactNotification',
    call: (s) =>
      s.sendContactNotification(['admin@clubinhonib.com'], {
        name: 'Ana',
        email: 'ana@exemplo.com',
        phone: '11999999999',
        message: 'Olá',
        receivedAt: NOW,
      }),
  },
  [EmailNotification.CommentNotification]: {
    method: 'sendCommentNotification',
    call: (s) =>
      s.sendCommentNotification(['admin@clubinhonib.com'], {
        name: 'Ana',
        comment: 'Foi ótimo',
        clubinho: '12',
        neighborhood: 'Centro',
        createdAt: NOW,
      }),
  },
  [EmailNotification.SiteFeedbackNotification]: {
    method: 'sendSiteFeedbackNotification',
    call: (s) =>
      s.sendSiteFeedbackNotification(['admin@clubinhonib.com'], {
        name: 'Ana',
        rating: 4,
        maxRating: 5,
        category: 'Navegação',
        comment: 'Bom',
        receivedAt: NOW,
      }),
  },
  [EmailNotification.IdeaSharedNotification]: {
    method: 'sendIdeaSharedNotification',
    call: (s) =>
      s.sendIdeaSharedNotification(['admin@clubinhonib.com'], {
        title: 'Uma ideia',
        description: 'Descrição',
        sharedAt: NOW,
      }),
  },
  [EmailNotification.ImageSharedNotification]: {
    method: 'sendImageSharedNotification',
    call: (s) =>
      s.sendImageSharedNotification(['admin@clubinhonib.com'], {
        caption: 'Visita de sábado',
        description: 'Descrição',
        sharedAt: NOW,
      }),
  },
  [EmailNotification.NewUserRegistrationNotification]: {
    method: 'sendNewUserRegistrationNotification',
    call: (s) =>
      s.sendNewUserRegistrationNotification(['admin@clubinhonib.com'], {
        name: 'Ana',
        email: 'ana@exemplo.com',
        provider: 'normal',
        registeredAt: NOW,
      }),
  },
  [EmailNotification.WeekMaterialAnnouncement]: {
    method: 'sendWeekMaterialAnnouncement',
    call: (s) =>
      s.sendWeekMaterialAnnouncement([recipient], {
        title: 'Semana 12',
        materialLink: LINK,
      }),
  },
  [EmailNotification.EventCreated]: {
    method: 'sendEventCreated',
    call: (s) =>
      s.sendEventCreated([recipient], {
        title: 'Festa',
        date: '2026-05-10',
        location: 'Sede',
        agendaLink: LINK,
      }),
  },
  [EmailNotification.EventUpdated]: {
    method: 'sendEventUpdated',
    call: (s) =>
      s.sendEventUpdated([recipient], {
        title: 'Festa',
        date: '2026-05-10',
        location: 'Sede',
        agendaLink: LINK,
      }),
  },
  [EmailNotification.EventCancelled]: {
    method: 'sendEventCancelled',
    call: (s) =>
      s.sendEventCancelled([recipient], {
        title: 'Festa',
        date: '2026-05-10',
        location: 'Sede',
        agendaLink: LINK,
      }),
  },
  [EmailNotification.EmailAddressChanged]: {
    method: 'sendEmailAddressChanged',
    call: (s) =>
      s.sendEmailAddressChanged('antigo@exemplo.com', {
        recipientName: 'Ana',
        newEmail: 'novo@exemplo.com',
        changedAt: NOW,
      }),
  },
  [EmailNotification.AccountApproved]: {
    method: 'sendAccountApproved',
    call: (s) =>
      s.sendAccountApproved(recipient, {
        recipientName: 'Ana',
        loginLink: LINK,
      }),
  },
  [EmailNotification.RoleChanged]: {
    method: 'sendRoleChanged',
    call: (s) =>
      s.sendRoleChanged(recipient, {
        recipientName: 'Ana',
        previousRole: 'Professor',
        currentRole: 'Coordenador',
        loginLink: LINK,
      }),
  },
  [EmailNotification.AccountDeactivated]: {
    method: 'sendAccountDeactivated',
    call: (s) => s.sendAccountDeactivated(recipient, { recipientName: 'Ana' }),
  },
  [EmailNotification.AccountDeleted]: {
    method: 'sendAccountDeleted',
    call: (s) =>
      s.sendAccountDeleted('ana@exemplo.com', { recipientName: 'Ana' }),
  },
  [EmailNotification.AccountCreatedByAdmin]: {
    method: 'sendAccountCreatedByAdmin',
    call: (s) =>
      s.sendAccountCreatedByAdmin(recipient, {
        recipientName: 'Ana',
        role: 'Professor',
        passwordSetupLink: LINK,
        validityHours: 24,
      }),
  },
  [EmailNotification.InformativePublished]: {
    method: 'sendInformativePublished',
    call: (s) =>
      s.sendInformativePublished([recipient], {
        title: 'Retiro de professores',
        informativeLink: LINK,
      }),
  },
  [EmailNotification.DocumentPublished]: {
    method: 'sendDocumentPublished',
    call: (s) =>
      s.sendDocumentPublished([recipient], {
        name: 'Manual do professor',
        documentLink: LINK,
      }),
  },
  [EmailNotification.ClubDayCancelled]: {
    method: 'sendClubDayCancelled',
    call: (s) =>
      s.sendClubDayCancelled([recipient], {
        date: '2026-05-01',
        reason: 'Dia do Trabalho',
        isRecurrent: true,
      }),
  },
  [EmailNotification.ContactReceipt]: {
    method: 'sendContactReceipt',
    call: (s) =>
      s.sendContactReceipt('ana@exemplo.com', {
        name: 'Ana',
        message: 'Gostaria de saber como ajudar.',
        receivedAt: NOW,
      }),
  },
  [EmailNotification.MissingPagelaReminder]: {
    method: 'sendMissingPagelaReminder',
    call: (s) =>
      s.sendMissingPagelaReminder([recipient], {
        clubNumber: 12,
        academicWeek: 8,
        academicYear: 2026,
        expectedDate: '2026-04-11',
        totalChildren: 10,
        withPagela: 7,
        missing: [{ childId: 'child-1', childName: 'Joana' }],
        pagelasLink: LINK,
      }),
  },
  [EmailNotification.CoordinatorWeeklySummary]: {
    method: 'sendCoordinatorWeeklySummary',
    call: (s) =>
      s.sendCoordinatorWeeklySummary(recipient, {
        recipientName: 'Ana',
        academicWeek: 8,
        academicYear: 2026,
        clubs: [
          {
            clubNumber: 12,
            status: 'Pagelas faltando',
            totalChildren: 10,
            withPagela: 7,
            missing: 3,
          },
        ],
        clubsOk: 2,
        panelLink: LINK,
      }),
  },
  [EmailNotification.AcceptedChristRegistered]: {
    method: 'sendAcceptedChristRegistered',
    call: (s) =>
      s.sendAcceptedChristRegistered([recipient], {
        childName: 'Joana',
        clubNumber: 12,
        decision: 'Aceitou a Jesus',
        registeredAt: NOW,
      }),
  },
};

describe('feature flag por notificação', () => {
  const smtpService = { sendMail: jest.fn() };
  const featureFlags = { isSwitchedOn: jest.fn() };
  const configService = {
    get: (key: string): string | undefined =>
      key === 'EMAIL_UNSUBSCRIBE_SECRET' ? 'segredo-de-teste' : undefined,
  };

  let service: EmailService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmailService,
        UnsubscribeTokenService,
        { provide: SmtpService, useValue: smtpService },
        {
          provide: SiteUrlService,
          useValue: { baseUrl: 'https://clubinhonib.com' },
        },
        { provide: ConfigService, useValue: configService },
        { provide: GetFeatureFlagsService, useValue: featureFlags },
      ],
    }).compile();

    service = moduleRef.get(EmailService);
  });

  const entries = Object.entries(DISPATCHERS) as [
    EmailNotification,
    (typeof DISPATCHERS)[EmailNotification],
  ][];

  describe.each(entries)('%s', (notification, dispatcher) => {
    it('consulta a própria flag antes de enviar', async () => {
      featureFlags.isSwitchedOn.mockResolvedValue(true);

      await dispatcher.call(service);

      expect(featureFlags.isSwitchedOn).toHaveBeenCalledWith(
        EMAIL_NOTIFICATION_FLAGS[notification],
        true,
      );
    });

    it('não envia nada com a flag desligada', async () => {
      featureFlags.isSwitchedOn.mockResolvedValue(false);

      await dispatcher.call(service);

      expect(smtpService.sendMail).not.toHaveBeenCalled();
    });

    it('envia com a flag ligada', async () => {
      featureFlags.isSwitchedOn.mockResolvedValue(true);

      await dispatcher.call(service);

      expect(smtpService.sendMail).toHaveBeenCalled();
    });
  });

  /**
   * O envio em massa devolve o resultado vazio quando bloqueado: contar como
   * enviado o que ninguém recebeu tornaria o log de quem chama uma ficção.
   */
  it('o aviso em massa bloqueado não conta destinatário nem envio', async () => {
    featureFlags.isSwitchedOn.mockResolvedValue(false);

    const result = await service.sendWeekMaterialAnnouncement([recipient], {
      title: 'Semana 12',
      materialLink: LINK,
    });

    expect(result).toEqual({ recipients: 0, sent: 0, failed: 0 });
  });

  /**
   * A rede de segurança da regra.
   *
   * Um método `send*` novo no `EmailService` que não esteja aqui reprova este
   * teste — e a única forma de fazê-lo passar é declarar a notificação, mapeá-la
   * para uma flag e semear a flag. Que é exatamente o processo obrigatório.
   */
  it('todo método de envio do EmailService está coberto por uma flag', () => {
    // `send` e `sendToEach` são os utilitários privados por onde os métodos
    // públicos passam; eles não são notificações.
    const internals = new Set(['send', 'sendToEach']);

    const publicSenders = Object.getOwnPropertyNames(EmailService.prototype)
      .filter((name) => name.startsWith('send'))
      .filter((name) => !internals.has(name));

    const covered = new Set(
      Object.values(DISPATCHERS).map((dispatcher) => dispatcher.method),
    );

    expect(publicSenders.filter((name) => !covered.has(name))).toEqual([]);
  });

  /** Sem a flag semeada, o interruptor não aparece no painel para ninguém. */
  it('toda flag de notificação está no catálogo de fábrica', () => {
    const seeded = new Set(DEFAULT_FEATURE_FLAGS.map((flag) => flag.key));
    const used = Object.values(EMAIL_NOTIFICATION_FLAGS) as FeatureFlagKeys[];

    expect(used.filter((key) => !seeded.has(key))).toEqual([]);
  });

  /**
   * Todas nascem ligadas: semear desligado silenciaria de uma vez avisos que já
   * funcionavam, inclusive a recuperação de senha.
   */
  it('as flags de notificação são semeadas ligadas', () => {
    const used = new Set<string>(Object.values(EMAIL_NOTIFICATION_FLAGS));
    const desligadas = DEFAULT_FEATURE_FLAGS.filter(
      (flag) => used.has(flag.key) && !flag.enabled,
    );

    expect(desligadas).toEqual([]);
  });
});
