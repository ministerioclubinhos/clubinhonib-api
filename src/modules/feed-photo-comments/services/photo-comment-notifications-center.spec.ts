import { EntityManager, In, IsNull, Repository } from 'typeorm';
import { UserRole } from 'src/core/auth/auth.types';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { ErrorCode } from 'src/shared/exceptions';
import { PhotoCommentNotificationEntity } from '../entities/photo-comment-notification.entity';
import { PhotoCommentNotificationsRepository } from '../repositories/photo-comment-notifications.repository';
import { GetFeedPhotoCommentsService } from './get-feed-photo-comments.service';
import { GetPhotoCommentNotificationsService } from './get-photo-comment-notifications.service';
import { UpdatePhotoCommentNotificationsService } from './update-photo-comment-notifications.service';
import { PHOTO_COMMENT_NOTIFICATION_READ_BATCH_SIZE } from '../constants';
import { chunkIds, toAggregate } from '../utils';

const createdAt = new Date('2026-11-03T10:00:00Z');
const notice = Object.assign(new PhotoCommentNotificationEntity(), {
  id: 'notice',
  recipientId: 'owner',
  commentId: 'comment',
  commentVersion: 1,
  commentText: 'Text',
  reason: 'Reason',
  createdAt,
  readAt: null,
});

describe('Photo comment inbox contracts used by the notification center', () => {
  const repo = {
    findPage: jest.fn(),
    countUnread: jest.fn(),
    findOwned: jest.fn(),
    aggregate: jest.fn(),
    findRecentUnread: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
  };
  const comments = {
    requireActiveActor: jest.fn(),
    requireFeature: jest.fn(),
    isFeatureEnabled: jest.fn(),
  };
  let get: GetPhotoCommentNotificationsService;
  let update: UpdatePhotoCommentNotificationsService;

  beforeEach(() => {
    jest.resetAllMocks();
    comments.requireActiveActor.mockResolvedValue({
      userId: 'owner',
      name: 'Ana',
      role: UserRole.TEACHER,
    });
    get = new GetPhotoCommentNotificationsService(
      repo as unknown as PhotoCommentNotificationsRepository,
      comments as unknown as GetFeedPhotoCommentsService,
    );
    update = new UpdatePhotoCommentNotificationsService(
      repo as unknown as PhotoCommentNotificationsRepository,
      get,
    );
  });

  it('reports the source as unavailable instead of failing when the feed flag is off', async () => {
    comments.isFeatureEnabled.mockResolvedValue(false);
    const access = await get.resolveInboxAccess('owner');
    expect(access).toEqual({
      actor: { userId: 'owner', name: 'Ana', role: UserRole.TEACHER },
      available: false,
    });
    expect(comments.isFeatureEnabled).toHaveBeenCalledWith(
      FeatureFlagKeys.CLUBINHO_FEED,
      UserRole.TEACHER,
    );
  });

  it('keeps the inactive account error on access resolution', async () => {
    comments.requireActiveActor.mockRejectedValue(new Error('inactive'));
    await expect(get.resolveInboxAccess('owner')).rejects.toThrow('inactive');
  });

  it('applies the unread filter and keeps the unread count independent of it', async () => {
    repo.findPage.mockResolvedValue([[notice], 1]);
    repo.countUnread.mockResolvedValue(4);
    const query = { page: 1, limit: 10, unreadOnly: true };
    const page = await get.findPageFor('owner', query);
    expect(repo.findPage).toHaveBeenCalledWith('owner', query);
    expect(page).toMatchObject({ total: 1, unreadCount: 4, pageCount: 1 });
  });

  it('returns 404 for a missing or foreign detail', async () => {
    repo.findOwned.mockResolvedValue(null);
    await expect(get.findOneFor('other', 'owner')).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
    expect(repo.findOwned).toHaveBeenCalledWith('other', 'owner');
  });

  it('returns the owned detail with comment and reason', async () => {
    repo.findOwned.mockResolvedValue(notice);
    await expect(get.findOneFor('notice', 'owner')).resolves.toMatchObject({
      commentText: 'Text',
      reason: 'Reason',
    });
  });

  it('summarizes aggregates and only identity/date of recent unread notices', async () => {
    repo.aggregate.mockResolvedValue({
      total: 3,
      unreadCount: 1,
      lastChangedAt: '2026-11-03 10:00:00.123456',
    });
    repo.findRecentUnread.mockResolvedValue([{ id: 'notice', createdAt }]);
    await expect(get.summarizeFor('owner')).resolves.toEqual({
      total: 3,
      unreadCount: 1,
      lastChangedAt: '2026-11-03 10:00:00.123456',
      recentUnread: [{ id: 'notice', createdAt: createdAt.toISOString() }],
    });
  });

  it('marks one notice for a verified recipient and 404s otherwise', async () => {
    repo.markRead.mockResolvedValueOnce(notice).mockResolvedValueOnce(null);
    await expect(update.markReadFor('notice', 'owner')).resolves.toMatchObject({
      id: 'notice',
    });
    await expect(update.markReadFor('x', 'owner')).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
  });

  it('delegates bulk read to the repository snapshot', async () => {
    repo.markAllRead.mockResolvedValue(2);
    await expect(update.markAllReadFor('owner')).resolves.toBe(2);
    expect(repo.markAllRead).toHaveBeenCalledWith('owner');
  });
});

describe('Photo comment inbox persistence for the notification center', () => {
  const builder = {
    select: jest.fn(),
    addSelect: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    setLock: jest.fn(),
    getRawOne: jest.fn(),
    getRawMany: jest.fn(),
  };
  const manager = { createQueryBuilder: jest.fn(), update: jest.fn() };
  const orm = {
    findAndCount: jest.fn(),
    findOneBy: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const repository = new PhotoCommentNotificationsRepository(
    orm as unknown as Repository<PhotoCommentNotificationEntity>,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    manager.createQueryBuilder.mockReturnValue(builder);
    orm.createQueryBuilder.mockReturnValue(builder);
    orm.manager.transaction.mockImplementation(
      (work: (entityManager: EntityManager) => Promise<number>) =>
        work(manager as unknown as EntityManager),
    );
    for (const key of [
      'select',
      'addSelect',
      'where',
      'andWhere',
      'setLock',
    ] as const)
      builder[key].mockReturnValue(builder);
  });

  it('filters unread rows in SQL before paginating', async () => {
    await repository.findPage('owner', { page: 2, limit: 5, unreadOnly: true });
    expect(orm.findAndCount).toHaveBeenCalledWith({
      where: { recipientId: 'owner', readAt: IsNull() },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: 5,
      take: 5,
    });
  });

  it('scopes the detail lookup by recipient', async () => {
    await repository.findOwned('notice', 'owner');
    expect(orm.findOneBy).toHaveBeenCalledWith({
      id: 'notice',
      recipientId: 'owner',
    });
  });

  it('aggregates without loading comment texts and parses raw counts', async () => {
    builder.getRawOne.mockResolvedValue({
      total: '3',
      unreadCount: '2',
      lastChangedAt: '2026-11-03 10:00:00.123456',
    });
    await expect(repository.aggregate('owner')).resolves.toEqual({
      total: 3,
      unreadCount: 2,
      lastChangedAt: '2026-11-03 10:00:00.123456',
    });
    expect(builder.where).toHaveBeenCalledWith(
      'notice.recipientId = :recipientId',
      { recipientId: 'owner' },
    );
  });

  it('loads only identity and date of recent unread notices', async () => {
    orm.find.mockResolvedValue([]);
    await repository.findRecentUnread('owner');
    expect(orm.find).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { id: true, createdAt: true },
        where: { recipientId: 'owner', readAt: IsNull() },
      }),
    );
  });

  it('updates only the locked snapshot of unread ids inside one transaction', async () => {
    const ids = Array.from(
      { length: PHOTO_COMMENT_NOTIFICATION_READ_BATCH_SIZE + 1 },
      (_, index) => ({ id: `n${index}` }),
    );
    builder.getRawMany.mockResolvedValue(ids);
    manager.update
      .mockResolvedValueOnce({
        affected: PHOTO_COMMENT_NOTIFICATION_READ_BATCH_SIZE,
      })
      .mockResolvedValueOnce({ affected: 0 });
    await expect(repository.markAllRead('owner')).resolves.toBe(
      PHOTO_COMMENT_NOTIFICATION_READ_BATCH_SIZE,
    );
    expect(orm.manager.transaction).toHaveBeenCalledTimes(1);
    expect(builder.setLock).toHaveBeenCalledWith('pessimistic_write');
    expect(manager.update).toHaveBeenCalledTimes(2);
    expect(manager.update).toHaveBeenLastCalledWith(
      PhotoCommentNotificationEntity,
      {
        id: In([`n${PHOTO_COMMENT_NOTIFICATION_READ_BATCH_SIZE}`]),
        recipientId: 'owner',
        readAt: IsNull(),
      },
      { readAt: expect.any(Date) as unknown },
    );
  });

  it('does not write when the snapshot is empty', async () => {
    builder.getRawMany.mockResolvedValue([]);
    await expect(repository.markAllRead('owner')).resolves.toBe(0);
    expect(manager.update).not.toHaveBeenCalled();
  });
});

describe('Photo comment inbox helpers', () => {
  it('chunks ids preserving order', () => {
    expect(chunkIds(['a', 'b', 'c'], 2)).toEqual([['a', 'b'], ['c']]);
    expect(chunkIds([], 2)).toEqual([]);
  });

  it('normalizes empty and Date aggregates', () => {
    expect(toAggregate(undefined)).toEqual({
      total: 0,
      unreadCount: 0,
      lastChangedAt: null,
    });
    expect(
      toAggregate({ total: 1, unreadCount: null, lastChangedAt: createdAt }),
    ).toEqual({
      total: 1,
      unreadCount: 0,
      lastChangedAt: createdAt.toISOString(),
    });
    expect(
      toAggregate({ total: 'x', unreadCount: '1', lastChangedAt: null }),
    ).toMatchObject({ total: 0, unreadCount: 1 });
  });
});
