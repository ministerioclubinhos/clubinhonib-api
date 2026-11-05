import { FeedPhotoCommentEntity } from './entities/feed-photo-comment.entity';
import { PhotoCommentNotificationEntity } from './entities/photo-comment-notification.entity';
import { PhotoCommentNotificationDto } from './dto/photo-comment-notification.dto';
import {
  OwnPhotoCommentResponseDto,
  PhotoCommentResponseDto,
} from './dto/photo-comment-response.dto';

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
