import {
  Brackets,
  DataSource,
  EntityManager,
  Repository,
  WhereExpressionBuilder,
} from 'typeorm';
import { PhotoCommentNotificationEntity } from '../entities/photo-comment-notification.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { FeedPhotoCommentEntity } from '../entities/feed-photo-comment.entity';
import { PhotoCommentStatus } from '../types';
import { FeedPhotoCommentsRepository } from './feed-photo-comments.repository';

describe('Feed photo comment persistence boundaries', () => {
  const orm = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    findOneOrFail: jest.fn(),
    countBy: jest.fn(),
  };
  const manager = { getRepository: jest.fn() };
  const dataSource = { transaction: jest.fn() };
  let repository: FeedPhotoCommentsRepository;
  beforeEach(() => {
    jest.resetAllMocks();
    manager.getRepository.mockReturnValue(orm);
    dataSource.transaction.mockImplementation(
      (work: (em: EntityManager) => Promise<unknown>) =>
        work(manager as unknown as EntityManager),
    );
    repository = new FeedPhotoCommentsRepository(
      orm as unknown as Repository<FeedPhotoCommentEntity>,
      dataSource as unknown as DataSource,
    );
  });
  it('public lists always constrain status and photo before paginating', async () => {
    await repository.findVisible('photo', { page: 2, limit: 10 });
    expect(orm.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mediaId: 'photo', status: PhotoCommentStatus.APPROVED },
        skip: 10,
        take: 10,
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    );
  });
  it('own history is constrained by both author and photo', async () => {
    await repository.findVisible('photo', { page: 1, limit: 10 }, 'author');
    expect(orm.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { mediaId: 'photo', authorId: 'author' },
      }),
    );
  });
  it('locks the user before doing transaction-scoped work', async () => {
    const order: string[] = [];
    orm.findOne.mockImplementation(() => {
      order.push('lock');
      return Promise.resolve({ id: 'author' });
    });
    const result = await repository.withAuthorLock('author', (em) => {
      expect(em).toBe(manager);
      order.push('work');
      return Promise.resolve(42);
    });
    expect(result).toBe(42);
    expect(manager.getRepository).toHaveBeenCalledWith(UserEntity);
    expect(orm.findOne).toHaveBeenCalledWith({
      where: { id: 'author' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(order).toEqual(['lock', 'work']);
  });
  it('uses the supplied transaction for retries, rate limits and pending writes', async () => {
    const em = manager as unknown as EntityManager;
    const since = new Date();
    await repository.findRequest('author', 'request', em);
    expect(orm.findOne).toHaveBeenCalledWith({
      where: { authorId: 'author', requestId: 'request' },
      relations: { author: true },
    });
    await repository.countRecent('author', since, em);
    expect(orm.countBy).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: 'author',
        createdAt: expect.objectContaining({ value: since }) as unknown,
      }),
    );
    orm.create.mockImplementation((data: unknown) => data);
    orm.save.mockResolvedValue({ id: 'saved' });
    orm.findOneOrFail.mockResolvedValue({ id: 'saved' });
    await repository.createPending('author', 'photo', 'text', 'request', em);
    expect(orm.create).toHaveBeenCalledWith({
      authorId: 'author',
      mediaId: 'photo',
      text: 'text',
      requestId: 'request',
      status: PhotoCommentStatus.PENDING,
      moderationReason: null,
      moderatedById: null,
      reviewedAt: null,
    });
    expect(orm.findOneOrFail).toHaveBeenCalledWith({
      where: { id: 'saved' },
      relations: { author: true },
    });
  });
  it('only approves the expected version and clears a previous rejection reason', async () => {
    orm.update.mockResolvedValue({ affected: 1 });
    expect(
      await repository.moderate('comment', 'admin', {
        status: PhotoCommentStatus.APPROVED,
        expectedVersion: 3,
        reason: 'ignored',
      }),
    ).toBe(true);
    expect(orm.update).toHaveBeenCalledWith(
      { id: 'comment', version: 3 },
      {
        status: PhotoCommentStatus.APPROVED,
        moderationReason: null,
        moderatedById: 'admin',
        reviewedAt: expect.any(Date) as unknown,
      },
    );
  });
  it.each(['Ajuste o texto', undefined])(
    'rejects with an optional private reason (%#)',
    async (reason) => {
      orm.update.mockResolvedValue({ affected: 0 });
      expect(
        await repository.moderate('comment', 'admin', {
          status: PhotoCommentStatus.REJECTED,
          expectedVersion: 2,
          reason,
        }),
      ).toBe(false);
      expect(orm.update).toHaveBeenCalledWith(
        { id: 'comment', version: 2 },
        expect.objectContaining({ moderationReason: reason ?? null }),
      );
    },
  );
  it('saves a notification with the same transaction manager as the rejection', async () => {
    orm.update.mockResolvedValue({ affected: 1 });
    const notices = {
      create: jest.fn().mockImplementation((value: unknown) => value),
      save: jest.fn(),
    };
    manager.getRepository.mockImplementation((entity: unknown) =>
      entity === PhotoCommentNotificationEntity ? notices : orm,
    );
    const notice = {
      recipientId: 'author',
      commentId: 'comment',
      commentVersion: 2,
      commentText: 'Text',
      reason: 'Reason',
    };
    await repository.moderate(
      'comment',
      'admin',
      {
        status: PhotoCommentStatus.REJECTED,
        expectedVersion: 1,
        reason: 'Reason',
      },
      notice,
    );
    expect(dataSource.transaction).toHaveBeenCalled();
    expect(notices.save).toHaveBeenCalledWith({ ...notice, readAt: null });
    notices.save.mockRejectedValue(new Error('write failed'));
    await expect(
      repository.moderate(
        'comment',
        'admin',
        {
          status: PhotoCommentStatus.REJECTED,
          expectedVersion: 1,
          reason: 'Reason',
        },
        notice,
      ),
    ).rejects.toThrow('write failed');
    notices.save.mockClear();
    orm.update.mockResolvedValue({ affected: 0 });
    expect(
      await repository.moderate(
        'comment',
        'admin',
        {
          status: PhotoCommentStatus.REJECTED,
          expectedVersion: 1,
          reason: 'Reason',
        },
        notice,
      ),
    ).toBe(false);
    expect(notices.save).not.toHaveBeenCalled();
  });
  it('scopes moderation to the configured feed and binds search values', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    orm.createQueryBuilder.mockReturnValue(qb);
    await expect(
      repository.findModeration('feed', {
        page: 2,
        limit: 10,
        status: PhotoCommentStatus.PENDING,
        searchString: "' OR 1=1 --",
      }),
    ).resolves.toEqual([[], 3]);
    expect(qb.where).toHaveBeenCalledWith(
      expect.stringContaining('section.pageId = :pageId'),
      expect.objectContaining({ pageId: 'feed' }),
    );
    expect(qb.andWhere).toHaveBeenCalledWith('comment.status = :status', {
      status: PhotoCommentStatus.PENDING,
    });
    const calls = qb.andWhere.mock.calls as unknown[][];
    const search = calls[1][0] as Brackets;
    search.whereFactory(qb as unknown as WhereExpressionBuilder);
    expect(qb.orWhere).toHaveBeenCalledWith('comment.text LIKE :search');
    expect(qb.andWhere).toHaveBeenCalledWith(search, {
      search: "%' OR 1=1 --%",
    });
    expect(qb.offset).toHaveBeenCalledWith(10);
    await repository.findModeration('feed', { page: 1, limit: 10 });
  });
  it('looks up and deletes only the requested ID', async () => {
    await repository.findById('comment');
    expect(orm.findOne).toHaveBeenCalledWith({
      where: { id: 'comment' },
      relations: { author: true },
    });
    await repository.delete('comment');
    expect(orm.delete).toHaveBeenCalledWith('comment');
  });
});
