import { Injectable } from '@nestjs/common';
import { UpdatePhotoCommentNotificationsService } from 'src/modules/feed-photo-comments/services/update-photo-comment-notifications.service';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { NOTIFICATION_NOT_FOUND_MESSAGE } from '../constants';
import {
  NotificationDto,
  NotificationsReadAllDto,
} from '../dto/notification-response.dto';
import { fromFeedNotice } from '../utils';
import { GetNotificationsService } from './get-notifications.service';

@Injectable()
export class UpdateNotificationsService {
  constructor(
    private readonly get: GetNotificationsService,
    private readonly feed: UpdatePhotoCommentNotificationsService,
  ) {}

  /** Idempotente: repetir mantém o primeiro `readAt`. */
  async markRead(id: string, userId: string): Promise<NotificationDto> {
    const access = await this.get.resolveAccess(userId);
    if (!access.feedAvailable)
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        NOTIFICATION_NOT_FOUND_MESSAGE,
      );
    const notice = await this.feed.markReadFor(id, access.recipientId);
    return fromFeedNotice(notice);
  }

  /**
   * Marca como lidos somente os avisos não lidos existentes no início da
   * operação; não altera pendências de perfil.
   */
  async markAllRead(userId: string): Promise<NotificationsReadAllDto> {
    const access = await this.get.resolveAccess(userId);
    const updatedCount = access.feedAvailable
      ? await this.feed.markAllReadFor(access.recipientId)
      : 0;
    const summary = await this.get.summaryFor(access);
    return { updatedCount, summary };
  }
}
