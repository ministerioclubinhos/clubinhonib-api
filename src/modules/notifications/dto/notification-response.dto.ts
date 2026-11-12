import { Paginated } from 'src/shared/dto/paginated.dto';
import { NotificationTargetKind, NotificationType } from '../types';

export class NotificationTargetDto {
  kind: NotificationTargetKind;
  commentId: string;
}

export class NotificationDto {
  id: string;
  type: NotificationType;
  createdAt: string;
  readAt: string | null;
  title: string;
  preview: string;
  target: NotificationTargetDto;
}

export class FeedCommentRejectedDetailsDto {
  type: NotificationType.FEED_COMMENT_REJECTED;
  commentText: string;
  reason: string;
}

export type NotificationDetailsDto = FeedCommentRejectedDetailsDto;

export class NotificationDetailDto extends NotificationDto {
  details: NotificationDetailsDto;
}

export class NotificationsPageDto extends Paginated<NotificationDto> {
  unreadCount: number;
}

export class NotificationRecentDto {
  id: string;
  type: NotificationType;
  createdAt: string;
}

export class NotificationSummaryDto {
  unreadCount: number;
  total: number;
  /** Chave opaca derivada do estado persistido; muda em criação, leitura e exclusão. */
  revision: string;
  /** Até dez avisos não lidos mais recentes, só com identidade e data. */
  recentUnread: NotificationRecentDto[];
}

export class NotificationsReadAllDto {
  updatedCount: number;
  summary: NotificationSummaryDto;
}
