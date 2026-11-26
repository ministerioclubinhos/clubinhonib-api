import { Test } from '@nestjs/testing';

import { NotificationService } from 'src/shared/providers/notification/notification.service';

import { CommentsRepository } from '../repositories/comments.repository';
import { CommentEntity } from '../entities/comment.entity';
import { CreateCommentService } from './create-comment.service';

const dto = {
  name: 'João Pedro',
  comment: 'Meu filho ama o clubinho.',
  clubinho: '12',
  neighborhood: 'Centro',
};

const saved = Object.assign(new CommentEntity(), {
  id: 'comment-1',
  ...dto,
  published: false,
  createdAt: new Date('2026-03-10T12:00:00Z'),
  updatedAt: new Date('2026-03-10T12:00:00Z'),
});

describe('CreateCommentService', () => {
  const commentsRepository = { createOne: jest.fn() };
  const notificationService = { notifyNewComment: jest.fn() };

  let service: CreateCommentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    commentsRepository.createOne.mockResolvedValue(saved);

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateCommentService,
        { provide: CommentsRepository, useValue: commentsRepository },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    service = moduleRef.get(CreateCommentService);
  });

  it('nasce aguardando publicação', async () => {
    await service.create(dto);

    expect(commentsRepository.createOne).toHaveBeenCalledWith(
      expect.objectContaining({ published: false }),
    );
  });

  it('avisa os administradores depois de salvar', async () => {
    // O canal existia e nunca era chamado: postar um comentário não avisava
    // ninguém, e ele ficava parado no painel.
    await service.create(dto);

    const savedAt = commentsRepository.createOne.mock.invocationCallOrder[0];
    const notifiedAt =
      notificationService.notifyNewComment.mock.invocationCallOrder[0];

    expect(notificationService.notifyNewComment).toHaveBeenCalledWith(saved);
    expect(savedAt).toBeLessThan(notifiedAt);
  });

  it('devolve o comentário no contrato de resposta', async () => {
    const response = await service.create(dto);

    expect(response.id).toBe('comment-1');
    expect(response.published).toBe(false);
    expect(response.createdAt).toBe('2026-03-10T12:00:00.000Z');
  });
});
