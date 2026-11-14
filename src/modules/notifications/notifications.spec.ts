import { UserRole } from 'src/core/auth/auth.types';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { GetPhotoCommentNotificationsService } from 'src/modules/feed-photo-comments/services/get-photo-comment-notifications.service';
import { UpdatePhotoCommentNotificationsService } from 'src/modules/feed-photo-comments/services/update-photo-comment-notifications.service';
import { PhotoCommentNotificationsPageDto } from 'src/modules/feed-photo-comments/dto/photo-comment-notification.dto';
import { AuthRequest } from 'src/core/auth/auth.types';
import { ErrorCode } from 'src/shared/exceptions';
import { NotificationsController } from './notifications.controller';
import { GetNotificationsService } from './services/get-notifications.service';
import { UpdateNotificationsService } from './services/update-notifications.service';
import {
  NotificationStatusFilter,
  NotificationTargetKind,
  NotificationType,
} from './types';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { buildRevision, fromFeedSummary } from './utils';
import {
  NOTIFICATION_FEED_REJECTED_PREVIEW,
  NOTIFICATION_REVISION_EMPTY,
} from './constants';

const feedNotice = {
  id: 'notice',
  commentId: 'comment',
  commentText: 'Private comment',
  reason: 'Private reason',
  createdAt: '2026-11-03T10:00:00.000Z',
  readAt: null,
};

function feedPage(): PhotoCommentNotificationsPageDto {
  const page = new PhotoCommentNotificationsPageDto([feedNotice], 1, 1, 10);
  page.unreadCount = 1;
  return page;
}

function query(
  overrides: Partial<QueryNotificationsDto> = {},
): QueryNotificationsDto {
  return Object.assign(new QueryNotificationsDto(), overrides);
}

const feedSummary = {
  total: 2,
  unreadCount: 1,
  lastChangedAt: '2026-11-03 10:00:00.123456',
  recentUnread: [{ id: 'notice', createdAt: feedNotice.createdAt }],
};

describe('Notification center facade', () => {
  const feed = {
    resolveInboxAccess: jest.fn(),
    findPageFor: jest.fn(),
    findOneFor: jest.fn(),
    summarizeFor: jest.fn(),
  };
  const feedUpdate = { markReadFor: jest.fn(), markAllReadFor: jest.fn() };
  const flags = { isEnabled: jest.fn() };
  let get: GetNotificationsService;
  let update: UpdateNotificationsService;

  beforeEach(() => {
    jest.resetAllMocks();
    feed.resolveInboxAccess.mockResolvedValue({
      actor: { userId: 'owner', name: 'Ana', role: UserRole.TEACHER },
      available: true,
    });
    flags.isEnabled.mockResolvedValue(true);
    feed.findPageFor.mockResolvedValue(feedPage());
    feed.summarizeFor.mockResolvedValue(feedSummary);
    get = new GetNotificationsService(
      feed as unknown as GetPhotoCommentNotificationsService,
      flags as unknown as GetFeatureFlagsService,
    );
    update = new UpdateNotificationsService(
      get,
      feedUpdate as unknown as UpdatePhotoCommentNotificationsService,
    );
  });

  it('takes the recipient from the session and checks the center flag by role', async () => {
    await get.list(query(), 'owner');
    expect(feed.resolveInboxAccess).toHaveBeenCalledWith('owner');
    expect(flags.isEnabled).toHaveBeenCalledWith(
      FeatureFlagKeys.NOTIFICATION_CENTER_V2,
      UserRole.TEACHER,
    );
    expect(feed.findPageFor).toHaveBeenCalledWith('owner', {
      page: 1,
      limit: 10,
      unreadOnly: false,
    });
  });

  it('refuses every operation while the center flag is off', async () => {
    flags.isEnabled.mockResolvedValue(false);
    const expected = { code: ErrorCode.FEATURE_DISABLED };
    await expect(get.summary('owner')).rejects.toMatchObject(expected);
    await expect(get.list(query(), 'owner')).rejects.toMatchObject(expected);
    await expect(get.detail('notice', 'owner')).rejects.toMatchObject(expected);
    await expect(update.markRead('notice', 'owner')).rejects.toMatchObject(
      expected,
    );
    await expect(update.markAllRead('owner')).rejects.toMatchObject(expected);
    expect(feed.findPageFor).not.toHaveBeenCalled();
    expect(feedUpdate.markAllReadFor).not.toHaveBeenCalled();
  });

  it('propagates the inactive account error', async () => {
    feed.resolveInboxAccess.mockRejectedValue(new Error('inactive'));
    await expect(get.summary('owner')).rejects.toThrow('inactive');
  });

  it('maps list items to a lean contract without private comment or reason', async () => {
    const page = await get.list(query(), 'owner');
    expect(page).toMatchObject({ total: 1, unreadCount: 1, pageCount: 1 });
    expect(page.data[0]).toEqual({
      id: 'notice',
      type: NotificationType.FEED_COMMENT_REJECTED,
      createdAt: feedNotice.createdAt,
      readAt: null,
      title: expect.any(String) as unknown,
      preview: NOTIFICATION_FEED_REJECTED_PREVIEW,
      target: {
        kind: NotificationTargetKind.FEED_COMMENT,
        commentId: 'comment',
      },
    });
    expect(JSON.stringify(page)).not.toContain('Private');
  });

  it('applies the unread filter in the source query', async () => {
    await get.list(query({ status: NotificationStatusFilter.UNREAD }), 'owner');
    expect(feed.findPageFor).toHaveBeenCalledWith(
      'owner',
      expect.objectContaining({ unreadOnly: true }),
    );
  });

  it('omits a disabled source instead of failing', async () => {
    feed.resolveInboxAccess.mockResolvedValue({
      actor: { userId: 'owner', name: 'Ana', role: UserRole.TEACHER },
      available: false,
    });
    await expect(get.list(query(), 'owner')).resolves.toMatchObject({
      data: [],
      total: 0,
      unreadCount: 0,
    });
    await expect(get.summary('owner')).resolves.toEqual({
      unreadCount: 0,
      total: 0,
      revision: NOTIFICATION_REVISION_EMPTY,
      recentUnread: [],
    });
    await expect(get.detail('notice', 'owner')).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
    await expect(update.markRead('notice', 'owner')).rejects.toMatchObject({
      code: ErrorCode.RESOURCE_NOT_FOUND,
    });
    await expect(update.markAllRead('owner')).resolves.toMatchObject({
      updatedCount: 0,
    });
    expect(feed.findPageFor).not.toHaveBeenCalled();
    expect(feedUpdate.markAllReadFor).not.toHaveBeenCalled();
  });

  it('keeps the unread count when the type filter excludes every source', async () => {
    const unknownType = 'OTHER' as NotificationType;
    await expect(
      get.list(query({ type: unknownType }), 'owner'),
    ).resolves.toMatchObject({ data: [], total: 0, unreadCount: 1 });
  });

  it('returns the private detail only through the owned lookup', async () => {
    feed.findOneFor.mockResolvedValue(feedNotice);
    await expect(get.detail('notice', 'owner')).resolves.toMatchObject({
      id: 'notice',
      details: {
        type: NotificationType.FEED_COMMENT_REJECTED,
        commentText: 'Private comment',
        reason: 'Private reason',
      },
    });
    expect(feed.findOneFor).toHaveBeenCalledWith('notice', 'owner');
  });

  it('summarizes with a revision and only ids/dates of recent unread notices', async () => {
    await expect(get.summary('owner')).resolves.toEqual({
      unreadCount: 1,
      total: 2,
      revision: 'feed:2:1:2026-11-03 10:00:00.123456',
      recentUnread: [
        {
          id: 'notice',
          type: NotificationType.FEED_COMMENT_REJECTED,
          createdAt: feedNotice.createdAt,
        },
      ],
    });
  });

  it('marks one notice as read for the session recipient', async () => {
    feedUpdate.markReadFor.mockResolvedValue({
      ...feedNotice,
      readAt: '2026-11-03T11:00:00.000Z',
    });
    await expect(update.markRead('notice', 'owner')).resolves.toMatchObject({
      readAt: '2026-11-03T11:00:00.000Z',
    });
    expect(feedUpdate.markReadFor).toHaveBeenCalledWith('notice', 'owner');
  });

  it('bulk read returns the updated count and a reconciled summary', async () => {
    feedUpdate.markAllReadFor.mockResolvedValue(3);
    await expect(update.markAllRead('owner')).resolves.toMatchObject({
      updatedCount: 3,
      summary: { unreadCount: 1 },
    });
    expect(feedUpdate.markAllReadFor).toHaveBeenCalledWith('owner');
  });
});

describe('Notification revision', () => {
  it('changes on creation, reading and deletion', () => {
    const base = buildRevision(feedSummary);
    expect(buildRevision({ ...feedSummary, total: 3 })).not.toBe(base);
    expect(buildRevision({ ...feedSummary, unreadCount: 0 })).not.toBe(base);
    expect(
      buildRevision({ ...feedSummary, lastChangedAt: '2026-11-03 10:00:01' }),
    ).not.toBe(base);
    expect(buildRevision({ ...feedSummary, lastChangedAt: null })).toBe(
      'feed:2:1:-',
    );
    expect(fromFeedSummary(null).revision).toBe(NOTIFICATION_REVISION_EMPTY);
  });
});

describe('Notifications controller', () => {
  it('delegates with the authenticated user id only', async () => {
    const getService = {
      summary: jest.fn().mockResolvedValue('summary'),
      list: jest.fn().mockResolvedValue('list'),
      detail: jest.fn().mockResolvedValue('detail'),
    };
    const updateService = {
      markRead: jest.fn().mockResolvedValue('read'),
      markAllRead: jest.fn().mockResolvedValue('all'),
    };
    const controller = new NotificationsController(
      getService as unknown as GetNotificationsService,
      updateService as unknown as UpdateNotificationsService,
    );
    const request = { user: { userId: 'owner' } } as unknown as AuthRequest;
    const listQuery = query();
    expect(await controller.summary(request)).toBe('summary');
    expect(await controller.list(listQuery, request)).toBe('list');
    expect(await controller.detail('notice', request)).toBe('detail');
    expect(await controller.read('notice', request)).toBe('read');
    expect(await controller.readAll(request)).toBe('all');
    expect(getService.list).toHaveBeenCalledWith(listQuery, 'owner');
    expect(getService.detail).toHaveBeenCalledWith('notice', 'owner');
    expect(updateService.markRead).toHaveBeenCalledWith('notice', 'owner');
    expect(updateService.markAllRead).toHaveBeenCalledWith('owner');
  });
});
