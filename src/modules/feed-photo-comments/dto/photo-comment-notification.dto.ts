import { Paginated } from 'src/shared/dto/paginated.dto';

export class PhotoCommentNotificationDto {
  id: string;
  commentId: string;
  commentText: string;
  reason: string;
  createdAt: string;
  readAt: string | null;
}

export class PhotoCommentNotificationsPageDto extends Paginated<PhotoCommentNotificationDto> {
  unreadCount: number;
}

export class PhotoCommentNotificationRecentDto {
  id: string;
  createdAt: string;
}

export class PhotoCommentNotificationSummaryDto {
  total: number;
  unreadCount: number;
  lastChangedAt: string | null;
  recentUnread: PhotoCommentNotificationRecentDto[];
}
