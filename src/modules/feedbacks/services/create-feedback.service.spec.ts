import { Test } from '@nestjs/testing';

import { NotificationService } from 'src/shared/providers/notification/notification.service';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { UserEntity } from 'src/core/user/entities/user.entity';

import { SiteFeedbacksRepository } from '../repositories/site-feedbacks.repository';
import { SiteFeedbackEntity } from '../entities/site-feedback.entity';
import { FeedbackCategory } from '../entities/feedback-category.enum';
import { CreateFeedbackService } from './create-feedback.service';

const dto = {
  rating: 4,
  comment: 'Site muito bom, mas o menu confunde.',
  category: FeedbackCategory.USABILITY,
};

const author = Object.assign(new UserEntity(), {
  id: 'user-1',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
});

const saved = Object.assign(new SiteFeedbackEntity(), {
  id: 'feedback-1',
  name: 'Ana Souza',
  email: 'ana@exemplo.com',
  ...dto,
  read: false,
  createdAt: new Date('2026-03-10T12:00:00Z'),
  updatedAt: new Date('2026-03-10T12:00:00Z'),
});

describe('CreateFeedbackService', () => {
  const feedbacksRepository = { createOne: jest.fn() };
  const notificationService = { notifyNewSiteFeedback: jest.fn() };
  const getUsersService = { findOne: jest.fn() };

  let service: CreateFeedbackService;

  beforeEach(async () => {
    jest.clearAllMocks();
    feedbacksRepository.createOne.mockResolvedValue(saved);
    getUsersService.findOne.mockResolvedValue(author);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateFeedbackService,
        { provide: SiteFeedbacksRepository, useValue: feedbacksRepository },
        { provide: NotificationService, useValue: notificationService },
        { provide: GetUsersService, useValue: getUsersService },
      ],
    }).compile();

    service = moduleRef.get(CreateFeedbackService);
  });

  it('assina a avaliação com o perfil de quem enviou', async () => {
    // Nome e e-mail não são aceitos no corpo: ninguém assina como outra pessoa.
    await service.create(dto, 'user-1');

    expect(getUsersService.findOne).toHaveBeenCalledWith('user-1');
    expect(feedbacksRepository.createOne).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana Souza' }),
    );
  });

  it('usa o e-mail da conta, que é por onde a equipe responde', async () => {
    await service.create(dto, 'user-1');

    expect(feedbacksRepository.createOne).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@exemplo.com' }),
    );
  });

  it('avisa os administradores depois de salvar', async () => {
    await service.create(dto, 'user-1');

    const savedAt = feedbacksRepository.createOne.mock.invocationCallOrder[0];
    const notifiedAt =
      notificationService.notifyNewSiteFeedback.mock.invocationCallOrder[0];

    expect(notificationService.notifyNewSiteFeedback).toHaveBeenCalledWith(
      saved,
    );
    expect(savedAt).toBeLessThan(notifiedAt);
  });

  it('devolve a avaliação no contrato de resposta', async () => {
    const response = await service.create(dto, 'user-1');

    expect(response.id).toBe('feedback-1');
    expect(response.createdAt).toBe('2026-03-10T12:00:00.000Z');
  });
});
