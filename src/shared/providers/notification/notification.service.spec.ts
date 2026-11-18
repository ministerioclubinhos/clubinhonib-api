import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { EmailService } from 'src/shared/email';
import { TwilioService } from '../twilio/twilio.service';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { FeedbackCategory } from 'src/modules/feedbacks/entities/feedback-category.enum';
import { SiteUrlService } from 'src/shared/site-url/site-url.service';
import { ContactEntity } from 'src/modules/contacts/entities/contact.entity';

/**
 * Dublês declarados como objetos simples, e não como `jest.Mocked<Classe>`.
 *
 * Com o tipo da classe, `expect(servico.metodo)` é uma referência a método sem
 * vínculo — o que o `unbound-method` acusa, com razão, porque `this` se perde.
 * Aqui os métodos são propriedades de um objeto literal, que é o que eles são.
 */
const createEmailServiceMock = () => ({
  sendContactNotification: jest.fn().mockResolvedValue(undefined),
  sendIdeaSharedNotification: jest.fn().mockResolvedValue(undefined),
  sendImageSharedNotification: jest.fn().mockResolvedValue(undefined),
  sendNewUserRegistrationNotification: jest.fn().mockResolvedValue(undefined),
  sendCommentNotification: jest.fn().mockResolvedValue(undefined),
  sendSiteFeedbackNotification: jest.fn().mockResolvedValue(undefined),
});

const createTwilioServiceMock = () => ({
  sendWhatsApp: jest.fn().mockResolvedValue(undefined),
});

const createGetUsersServiceMock = () => ({
  findAdminEmails: jest
    .fn()
    .mockResolvedValue(['admin1@nib.com', 'admin2@nib.com']),
  findByEmail: jest
    .fn()
    .mockResolvedValue({ name: 'Maria Silva', email: 'maria@exemplo.com' }),
});

describe('NotificationService', () => {
  let service: NotificationService;
  let emailService: ReturnType<typeof createEmailServiceMock>;
  let twilioService: ReturnType<typeof createTwilioServiceMock>;
  let getUsersService: ReturnType<typeof createGetUsersServiceMock>;

  const mockContact: ContactEntity = {
    id: 'contact-1',
    name: 'João',
    email: 'joao@exemplo.com',
    phone: '(11) 99999-8888',
    message: 'Mensagem de teste',
    read: false,
    createdAt: new Date('2026-03-10T12:00:00Z'),
    updatedAt: new Date('2026-03-10T12:00:00Z'),
  };

  beforeEach(async () => {
    emailService = createEmailServiceMock();
    twilioService = createTwilioServiceMock();
    getUsersService = createGetUsersServiceMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: EmailService, useValue: emailService },
        { provide: TwilioService, useValue: twilioService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('whatsapp:+5511999999999'),
          },
        },
        {
          provide: SiteUrlService,
          useValue: {
            buildUrl: (...segments: string[]) =>
              `https://clubinhonib.com/${segments.join('/')}`,
          },
        },
        { provide: GetUsersService, useValue: getUsersService },
      ],
    }).compile();

    service = moduleRef.get<NotificationService>(NotificationService);
  });

  it('busca os e-mails de admins no banco e dispara notificação por e-mail e whatsapp para novo contato', async () => {
    await service.notifyNewContact(mockContact);

    expect(getUsersService.findAdminEmails.mock.calls).toHaveLength(1);
    expect(emailService.sendContactNotification.mock.calls[0]).toEqual([
      ['admin1@nib.com', 'admin2@nib.com'],
      expect.objectContaining({
        name: 'João',
        email: 'joao@exemplo.com',
        phone: '(11) 99999-8888',
        message: 'Mensagem de teste',
      }),
    ]);
    expect(twilioService.sendWhatsApp.mock.calls).toHaveLength(1);
  });

  it('busca os e-mails de admins e avisa sobre nova ideia compartilhada', async () => {
    await service.notifyNewIdeaShared(
      {
        title: 'Brincadeira dos Balões',
        description: 'Ideia para o clubinho de sábado',
        createdAt: new Date('2026-03-10T12:00:00Z'),
      },
      { email: 'maria@exemplo.com' },
    );

    expect(getUsersService.findAdminEmails).toHaveBeenCalled();
    expect(getUsersService.findByEmail).toHaveBeenCalledWith(
      'maria@exemplo.com',
    );
    expect(emailService.sendIdeaSharedNotification).toHaveBeenCalledWith(
      ['admin1@nib.com', 'admin2@nib.com'],
      expect.objectContaining({
        title: 'Brincadeira dos Balões',
        description: 'Ideia para o clubinho de sábado',
        authorName: 'Maria Silva',
        authorEmail: 'maria@exemplo.com',
      }),
    );
  });

  it('busca os e-mails de admins e avisa sobre novas imagens compartilhadas', async () => {
    await service.notifyNewImageShared(
      {
        caption: 'Fotos do Evento de Páscoa',
        description: 'Crianças reunidas na escola',
        createdAt: new Date('2026-03-10T12:00:00Z'),
      },
      { email: 'maria@exemplo.com' },
    );

    expect(getUsersService.findAdminEmails).toHaveBeenCalled();
    expect(getUsersService.findByEmail).toHaveBeenCalledWith(
      'maria@exemplo.com',
    );
    expect(emailService.sendImageSharedNotification).toHaveBeenCalledWith(
      ['admin1@nib.com', 'admin2@nib.com'],
      expect.objectContaining({
        caption: 'Fotos do Evento de Páscoa',
        description: 'Crianças reunidas na escola',
        authorName: 'Maria Silva',
        authorEmail: 'maria@exemplo.com',
      }),
    );
  });

  it('busca os e-mails de admins e avisa sobre novo pré-cadastro de usuário', async () => {
    await service.notifyNewUserRegistration(
      {
        name: 'Carlos Oliveira',
        email: 'carlos@exemplo.com',
        createdAt: new Date('2026-03-10T12:00:00Z'),
      },
      'google',
    );

    expect(getUsersService.findAdminEmails).toHaveBeenCalled();
    expect(
      emailService.sendNewUserRegistrationNotification,
    ).toHaveBeenCalledWith(
      ['admin1@nib.com', 'admin2@nib.com'],
      expect.objectContaining({
        name: 'Carlos Oliveira',
        email: 'carlos@exemplo.com',
        provider: 'google',
      }),
    );
  });

  it('busca os e-mails de admins e avisa sobre novo comentário na Área do Professor', async () => {
    await service.notifyNewComment({
      id: 'comment-1',
      name: 'Professor Pedro',
      comment: 'Ótima aula hoje!',
      clubinho: 'Clubinho #12',
      neighborhood: 'Centro',
      createdAt: new Date('2026-03-10T12:00:00Z'),
    });

    expect(getUsersService.findAdminEmails).toHaveBeenCalled();
    expect(emailService.sendCommentNotification).toHaveBeenCalledWith(
      ['admin1@nib.com', 'admin2@nib.com'],
      expect.objectContaining({
        name: 'Professor Pedro',
        comment: 'Ótima aula hoje!',
        clubinho: 'Clubinho #12',
        neighborhood: 'Centro',
      }),
    );
  });

  describe('link para o painel', () => {
    it('leva cada aviso à tela onde ele se resolve', async () => {
      await service.notifyNewContact({
        id: 'contact-1',
        name: 'Maria',
        email: 'maria@exemplo.com',
        phone: '92999990000',
        message: 'Olá',
      } as never);
      await service.notifyNewComment({
        id: 'comment-1',
        name: 'João',
        comment: 'Ótimo',
        clubinho: '12',
        neighborhood: 'Centro',
      });
      await service.notifyNewSiteFeedback({
        name: 'Ana',
        rating: 4,
        category: FeedbackCategory.USABILITY,
        comment: 'Bom',
      });

      // O aviso conta o que chegou; o botão diz para onde ir.
      expect(emailService.sendContactNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          panelUrl: 'https://clubinhonib.com/adm/contatos',
        }),
      );
      expect(emailService.sendCommentNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          panelUrl: 'https://clubinhonib.com/adm/comentarios',
        }),
      );
      expect(emailService.sendSiteFeedbackNotification).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          panelUrl: 'https://clubinhonib.com/adm/feedbacks',
        }),
      );
    });
  });
});
