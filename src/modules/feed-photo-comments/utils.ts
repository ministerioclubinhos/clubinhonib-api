import { FeedPhotoCommentEntity } from './entities/feed-photo-comment.entity';
import { PhotoCommentNotificationEntity } from './entities/photo-comment-notification.entity';
import {
  PhotoCommentNotificationDto,
  PhotoCommentNotificationRecentDto,
} from './dto/photo-comment-notification.dto';
import {
  OwnPhotoCommentResponseDto,
  PhotoCommentResponseDto,
} from './dto/photo-comment-response.dto';
import {
  PhotoCommentNotificationAggregate,
  PhotoCommentNotificationRecentRow,
  RawNotificationAggregate,
} from './types';

export function trimPhotoCommentText({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export function toPublicPhotoComment(
  comment: FeedPhotoCommentEntity,
): PhotoCommentResponseDto {
  return {
    id: comment.id,
    mediaId: comment.mediaId,
    text: comment.text,
    authorName: comment.author.name,
    createdAt: comment.createdAt.toISOString(),
  };
}

export function toOwnPhotoComment(
  comment: FeedPhotoCommentEntity,
): OwnPhotoCommentResponseDto {
  return {
    ...toPublicPhotoComment(comment),
    status: comment.status,
    moderationReason: comment.moderationReason,
    version: comment.version,
  };
}

export function toPhotoCommentNotification(
  notice: PhotoCommentNotificationEntity,
): PhotoCommentNotificationDto {
  return {
    id: notice.id,
    commentId: notice.commentId,
    commentText: notice.commentText,
    reason: notice.reason,
    createdAt: notice.createdAt.toISOString(),
    readAt: notice.readAt?.toISOString() ?? null,
  };
}

export function chunkIds(ids: string[], size: number): string[][] {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += size)
    chunks.push(ids.slice(start, start + size));
  return chunks;
}

function toCount(value: string | number | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function toAggregate(
  raw: RawNotificationAggregate | undefined,
): PhotoCommentNotificationAggregate {
  const changed = raw?.lastChangedAt ?? null;
  return {
    total: toCount(raw?.total),
    unreadCount: toCount(raw?.unreadCount),
    lastChangedAt:
      changed === null
        ? null
        : changed instanceof Date
          ? changed.toISOString()
          : String(changed),
  };
}

export function toPhotoCommentNotificationRecent(
  row: PhotoCommentNotificationRecentRow,
): PhotoCommentNotificationRecentDto {
  return { id: row.id, createdAt: row.createdAt.toISOString() };
}
