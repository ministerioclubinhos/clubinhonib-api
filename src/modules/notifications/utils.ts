import {
  PhotoCommentNotificationDto,
  PhotoCommentNotificationRecentDto,
  PhotoCommentNotificationsPageDto,
  PhotoCommentNotificationSummaryDto,
} from 'src/modules/feed-photo-comments/dto/photo-comment-notification.dto';
import {
  NOTIFICATION_FEED_REJECTED_PREVIEW,
  NOTIFICATION_FEED_REJECTED_TITLE,
  NOTIFICATION_REVISION_EMPTY,
  NOTIFICATION_REVISION_FEED_PREFIX,
  NOTIFICATION_REVISION_SEPARATOR,
} from './constants';
import {
  NotificationDetailDto,
  NotificationDto,
  NotificationRecentDto,
  NotificationsPageDto,
  NotificationSummaryDto,
} from './dto/notification-response.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import {
  NotificationStatusFilter,
  NotificationTargetKind,
  NotificationType,
} from './types';

export function fromFeedNotice(
  notice: PhotoCommentNotificationDto,
): NotificationDto {
  return {
    id: notice.id,
    type: NotificationType.FEED_COMMENT_REJECTED,
    createdAt: notice.createdAt,
    readAt: notice.readAt,
    title: NOTIFICATION_FEED_REJECTED_TITLE,
    preview: NOTIFICATION_FEED_REJECTED_PREVIEW,
    target: {
      kind: NotificationTargetKind.FEED_COMMENT,
      commentId: notice.commentId,
    },
  };
}

export function fromFeedNoticeDetail(
  notice: PhotoCommentNotificationDto,
): NotificationDetailDto {
  return {
    ...fromFeedNotice(notice),
    details: {
      type: NotificationType.FEED_COMMENT_REJECTED,
      commentText: notice.commentText,
      reason: notice.reason,
    },
  };
}

export function fromFeedPage(
  page: PhotoCommentNotificationsPageDto,
): NotificationsPageDto {
  const result = new NotificationsPageDto(
    page.data.map(fromFeedNotice),
    page.total,
    page.page,
    page.limit,
  );
  result.unreadCount = page.unreadCount;
  return result;
}

export function emptyPage(
  query: QueryNotificationsDto,
  unreadCount = 0,
): NotificationsPageDto {
  const page = new NotificationsPageDto([], 0, query.page, query.limit);
  page.unreadCount = unreadCount;
  return page;
}

/** A consulta pede uma origem que a fachada consegue atender? */
export function includesFeedSource(query: QueryNotificationsDto): boolean {
  return !query.type || query.type === NotificationType.FEED_COMMENT_REJECTED;
}

export function isUnreadFilter(query: QueryNotificationsDto): boolean {
  return query.status === NotificationStatusFilter.UNREAD;
}

function fromFeedRecent(
  recent: PhotoCommentNotificationRecentDto,
): NotificationRecentDto {
  return {
    id: recent.id,
    type: NotificationType.FEED_COMMENT_REJECTED,
    createdAt: recent.createdAt,
  };
}

export function buildRevision(
  feed: PhotoCommentNotificationSummaryDto | null,
): string {
  if (!feed) return NOTIFICATION_REVISION_EMPTY;
  return [
    NOTIFICATION_REVISION_FEED_PREFIX,
    feed.total,
    feed.unreadCount,
    feed.lastChangedAt ?? NOTIFICATION_REVISION_EMPTY,
  ].join(NOTIFICATION_REVISION_SEPARATOR);
}

export function fromFeedSummary(
  feed: PhotoCommentNotificationSummaryDto | null,
): NotificationSummaryDto {
  return {
    unreadCount: feed?.unreadCount ?? 0,
    total: feed?.total ?? 0,
    revision: buildRevision(feed),
    recentUnread: feed?.recentUnread.map(fromFeedRecent) ?? [],
  };
}
