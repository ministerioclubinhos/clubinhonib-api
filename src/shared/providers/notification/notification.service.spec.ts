import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { EmailService } from 'src/shared/email';
import { TwilioService } from '../twilio/twilio.service';
import { UserRepository } from 'src/core/user/user.repository';
import { ContactEntity } from 'src/modules/contacts/contact.entity';

describe('NotificationService', () => {
  let service: NotificationService;
  let emailService: jest.Mocked<EmailService>;
  let twilioService: jest.Mocked<TwilioService>;
  let userRepository: jest.Mocked<UserRepository>;

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
    emailService = {
      sendContactNotification: jest.fn().mockResolvedValue(undefined),
      sendIdeaSharedNotification: jest.fn().mockResolvedValue(undefined),
      sendImageSharedNotification: jest.fn().mockResolvedValue(undefined),
      sendNewUserRegistrationNotification: jest.fn().mockResolvedValue(undefined),
      sendCommentNotification: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EmailService>;

    twilioService = {
      sendWhatsApp: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<TwilioService>;

    userRepository = {
      findAdminEmails: jest
        .fn()
        .mockResolvedValue(['admin1@nib.com', 'admin2@nib.com']),
      findByEmail: jest
        .fn()
        .mockResolvedValue({ name: 'Maria Silva', email: 'maria@exemplo.com' }),
    } as unknown as jest.Mocked<UserRepository>;

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
        { provide: UserRepository, useValue: userRepository },
      ],
    }).compile();

    service = moduleRef.get<NotificationService>(NotificationService);
  });

  it('busca os e-mails de admins no banco e dispara notificação por e-mail e whatsapp para novo contato', async () => {
    await service.notifyNewContact(mockContact);

    expect(userRepository.findAdminEmails.mock.calls).toHaveLength(1);
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

    expect(userRepository.findAdminEmails).toHaveBeenCalled();
    expect(userRepository.findByEmail).toHaveBeenCalledWith('maria@exemplo.com');
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

    expect(userRepository.findAdminEmails).toHaveBeenCalled();
    expect(userRepository.findByEmail).toHaveBeenCalledWith('maria@exemplo.com');
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

    expect(userRepository.findAdminEmails).toHaveBeenCalled();
    expect(emailService.sendNewUserRegistrationNotification).toHaveBeenCalledWith(
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

    expect(userRepository.findAdminEmails).toHaveBeenCalled();
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
});
