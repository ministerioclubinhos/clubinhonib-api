import { Test } from '@nestjs/testing';

import { NotificationService } from 'src/shared/providers/notification/notification.service';

import { ContactsRepository } from '../repositories/contacts.repository';
import { ContactEntity } from '../entities/contact.entity';
import { CreateContactService } from './create-contact.service';

const dto = {
  name: 'Maria Silva',
  email: 'maria@example.com',
  phone: '92999990000',
  message: 'Gostaria de saber mais sobre o clubinho.',
};

const saved = Object.assign(new ContactEntity(), {
  id: 'contact-1',
  ...dto,
  read: false,
  createdAt: new Date('2026-03-10T12:00:00Z'),
  updatedAt: new Date('2026-03-10T12:00:00Z'),
});

describe('CreateContactService', () => {
  const contactsRepository = { createOne: jest.fn() };
  const notificationService = { notifyNewContact: jest.fn() };

  let service: CreateContactService;

  beforeEach(async () => {
    jest.clearAllMocks();
    contactsRepository.createOne.mockResolvedValue(saved);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateContactService,
        { provide: ContactsRepository, useValue: contactsRepository },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = moduleRef.get(CreateContactService);
  });

  it('avisa os administradores depois de salvar', async () => {
    await service.create(dto);

    const savedAt = contactsRepository.createOne.mock.invocationCallOrder[0];
    const notifiedAt =
      notificationService.notifyNewContact.mock.invocationCallOrder[0];

    expect(notificationService.notifyNewContact).toHaveBeenCalledWith(saved);
    expect(savedAt).toBeLessThan(notifiedAt);
  });

  it('devolve o contato no contrato de resposta', async () => {
    const response = await service.create(dto);

    expect(response.id).toBe('contact-1');
    expect(response.read).toBe(false);
  });
});
