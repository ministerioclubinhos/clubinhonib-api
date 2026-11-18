import { Logger } from '@nestjs/common';
import { IsNull, Repository } from 'typeorm';
import { UserRole } from 'src/core/auth/auth.types';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';
import { ErrorCode } from 'src/shared/exceptions';
import { PhotoCommentNotificationEntity } from '../entities/photo-comment-notification.entity';
import { PhotoCommentNotificationsRepository } from '../repositories/photo-comment-notifications.repository';
import { GetFeedPhotoCommentsService } from './get-feed-photo-comments.service';
import { GetPhotoCommentNotificationsService } from './get-photo-comment-notifications.service';
import { UpdatePhotoCommentNotificationsService } from './update-photo-comment-notifications.service';
import { CreatePhotoCommentRejectionEmailService } from './create-photo-comment-rejection-email.service';

const notice = Object.assign(new PhotoCommentNotificationEntity(), {
  id: 'notice',
  recipientId: 'owner',
  commentId: 'comment',
  commentVersion: 2,
  commentText: 'Text',
  reason: 'Reason',
  createdAt: new Date('2026-11-03T10:00:00Z'),
  readAt: null,
});
const query = { page: 2, limit: 10 };

describe('Photo comment notification inbox', () => {
  const repo = {
    findPage: jest.fn(),
    countUnread: jest.fn(),
    markRead: jest.fn(),
  };
  const comments = { requireActiveActor: jest.fn(), requireFeature: jest.fn() };
  let get: GetPhotoCommentNotificationsService;
  let update: UpdatePhotoCommentNotificationsService;
  beforeEach(() => {
    jest.resetAllMocks();
    comments.requireActiveActor.mockResolvedValue({
      userId: 'owner',
      role: UserRole.TEACHER,
    });
    repo.findPage.mockResolvedValue([[notice], 11]);
    repo.countUnread.mockResolvedValue(1);
    get = new GetPhotoCommentNotificationsService(
      repo as unknown as PhotoCommentNotificationsRepository,
      comments as unknown as GetFeedPhotoCommentsService,
    );
    update = new UpdatePhotoCommentNotificationsService(
      repo as unknown as PhotoCommentNotificationsRepository,
      get,
    );
  });
  it('only lists the current owner and exposes an explicit safe DTO with unread count', async () => {
    const result = await get.findMine(query, 'owner');
    expect(repo.findPage).toHaveBeenCalledWith('owner', {
      ...query,
      unreadOnly: false,
    });
    expect(repo.countUnread).toHaveBeenCalledWith('owner');
    expect(result).toMatchObject({
      page: 2,
      pageCount: 2,
      total: 11,
      unreadCount: 1,
    });
    expect(result.data[0]).toEqual({
      id: 'notice',
      commentId: 'comment',
      commentText: 'Text',
      reason: 'Reason',
      createdAt: notice.createdAt.toISOString(),
      readAt: null,
    });
    expect(comments.requireFeature).toHaveBeenCalledWith(
      FeatureFlagKeys.CLUBINHO_FEED,
      UserRole.TEACHER,
    );
  });
  it('enforces fresh active account checks on listing and reading', async () => {
    comments.requireActiveActor.mockRejectedValue(new Error('inactive'));
    await expect(get.findMine(query, 'owner')).rejects.toThrow('inactive');
    await expect(update.markRead('notice', 'owner')).rejects.toThrow(
      'inactive',
    );
    expect(repo.findPage).not.toHaveBeenCalled();
    expect(repo.markRead).not.toHaveBeenCalled();
  });
  it('enforces the feed feature flag on listing and reading', async () => {
    comments.requireFeature.mockRejectedValue(new Error('disabled'));
    await expect(get.findMine(query, 'owner')).rejects.toThrow('disabled');
    await expect(update.markRead('notice', 'owner')).rejects.toThrow(
      'disabled',
    );
    expect(repo.findPage).not.toHaveBeenCalled();
    expect(repo.markRead).not.toHaveBeenCalled();
  });
  it('does not reveal another owner’s notification', async () => {
    repo.markRead.mockResolvedValue(null);
    await expect(update.markRead('private', 'owner')).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
    expect(repo.markRead).toHaveBeenCalledWith('private', 'owner');
  });
  it('returns the persisted read timestamp', async () => {
    const readAt = new Date();
    repo.markRead.mockResolvedValue({ ...notice, readAt });
    expect(await update.markRead('notice', 'owner')).toMatchObject({
      readAt: readAt.toISOString(),
    });
  });
});

describe('Notification persistence ownership', () => {
  const orm = {
    findAndCount: jest.fn(),
    countBy: jest.fn(),
    update: jest.fn(),
    findOneBy: jest.fn(),
  };
  const repository = new PhotoCommentNotificationsRepository(
    orm as unknown as Repository<PhotoCommentNotificationEntity>,
  );
  beforeEach(() => jest.resetAllMocks());
  it('scopes paginated results and unread count by recipient', async () => {
    await repository.findPage('owner', query);
    await repository.countUnread('owner');
    expect(orm.findAndCount).toHaveBeenCalledWith({
      where: { recipientId: 'owner' },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: 10,
      take: 10,
    });
    expect(orm.countBy).toHaveBeenCalledWith({
      recipientId: 'owner',
      readAt: IsNull(),
    });
  });
  it('does not overwrite an existing read timestamp and scopes both write and read', async () => {
    orm.findOneBy.mockResolvedValue(notice);
    expect(await repository.markRead('notice', 'owner')).toBe(notice);
    expect(orm.update).toHaveBeenCalledWith(
      { id: 'notice', recipientId: 'owner', readAt: IsNull() },
      { readAt: expect.any(Date) as unknown },
    );
    expect(orm.findOneBy).toHaveBeenCalledWith({
      id: 'notice',
      recipientId: 'owner',
    });
  });
});

describe('Rejection email orchestration', () => {
  it('uses the shared flagged email service and never propagates delivery failure', async () => {
    const email = {
      sendFeedPhotoCommentRejected: jest.fn().mockResolvedValue(undefined),
    };
    const url = {
      buildUrl: jest.fn().mockReturnValue('https://example.test/feed-clubinho'),
    };
    const service = new CreatePhotoCommentRejectionEmailService(
      email as unknown as EmailService,
      url as unknown as SiteUrlService,
    );
    const author = Object.assign(new UserEntity(), {
      id: 'owner',
      name: 'Ana',
      email: 'ana@example.test',
      active: true,
    });
    service.sendInBackground(author, notice);
    expect(email.sendFeedPhotoCommentRejected).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'owner', active: true }),
      {
        recipientName: 'Ana',
        commentText: 'Text',
        reason: 'Reason',
        feedLink: 'https://example.test/feed-clubinho',
      },
    );
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    email.sendFeedPhotoCommentRejected.mockRejectedValue(
      new Error('SMTP unavailable'),
    );
    service.sendInBackground(author, notice);
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(log).toHaveBeenCalledWith(
      'Falha no aviso de reprovação do comentário comment.',
    );
    log.mockRestore();
  });
});
