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
