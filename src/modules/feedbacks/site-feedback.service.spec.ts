import { Test } from '@nestjs/testing';
import { NotificationService } from 'src/shared/providers/notification/notification.service';
import { GetUsersService } from 'src/core/user/services/get-user.service';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { SiteFeedbackRepository } from './repository/site-feedback.repository';
import { SiteFeedbackEntity } from './entity/site-feedback.entity';
import { FeedbackCategory } from './entity/feedback-category.enum';
import { SiteFeedbackService } from './site-feedback.service';

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
});

describe('SiteFeedbackService', () => {
  const siteFeedbackRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findAll: jest.fn(),
    findOneBy: jest.fn(),
  };
  const notificationService = { notifyNewSiteFeedback: jest.fn() };
  const getUsersService = { findOne: jest.fn() };

  let service: SiteFeedbackService;

  beforeEach(async () => {
    jest.clearAllMocks();
    siteFeedbackRepo.create.mockReturnValue(saved);
    siteFeedbackRepo.save.mockResolvedValue(saved);
    getUsersService.findOne.mockResolvedValue(author);

    const moduleRef = await Test.createTestingModule({
      providers: [
        SiteFeedbackService,
        { provide: SiteFeedbackRepository, useValue: siteFeedbackRepo },
        { provide: NotificationService, useValue: notificationService },
        { provide: GetUsersService, useValue: getUsersService },
      ],
    }).compile();

    service = moduleRef.get(SiteFeedbackService);
  });

  it('assina a avaliação com o perfil de quem enviou', async () => {
    // Nome e e-mail não são aceitos no corpo: ninguém assina como outra pessoa.
    await service.create(dto, 'user-1');

    expect(getUsersService.findOne).toHaveBeenCalledWith('user-1');
    expect(siteFeedbackRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Ana Souza' }),
    );
  });

  it('usa o e-mail da conta, que é por onde a equipe responde', async () => {
    await service.create(dto, 'user-1');

    expect(siteFeedbackRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'ana@exemplo.com' }),
    );
  });

  it('avisa os administradores depois de salvar', async () => {
    await service.create(dto, 'user-1');

    const savedAt = siteFeedbackRepo.save.mock.invocationCallOrder[0];
    const notifiedAt =
      notificationService.notifyNewSiteFeedback.mock.invocationCallOrder[0];

    expect(notificationService.notifyNewSiteFeedback).toHaveBeenCalledWith(
      saved,
    );
    expect(savedAt).toBeLessThan(notifiedAt);
  });

  it('devolve a avaliação salva', async () => {
    await expect(service.create(dto, 'user-1')).resolves.toBe(saved);
  });
});
