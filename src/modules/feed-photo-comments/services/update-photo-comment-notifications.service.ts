import { Injectable } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { PhotoCommentNotificationsRepository } from '../repositories/photo-comment-notifications.repository';
import { GetPhotoCommentNotificationsService } from './get-photo-comment-notifications.service';
import { PhotoCommentNotificationDto } from '../dto/photo-comment-notification.dto';
import { toPhotoCommentNotification } from '../utils';

@Injectable()
export class UpdatePhotoCommentNotificationsService {
  constructor(
    private readonly repository: PhotoCommentNotificationsRepository,
    private readonly get: GetPhotoCommentNotificationsService,
  ) {}

  async markRead(
    id: string,
    userId: string,
  ): Promise<PhotoCommentNotificationDto> {
    const actor = await this.get.requireActor(userId);
    return this.markReadFor(id, actor.userId);
  }

  /** Leitura individual idempotente para um destinatário já verificado. */
  async markReadFor(
    id: string,
    recipientId: string,
  ): Promise<PhotoCommentNotificationDto> {
    const notice = await this.repository.markRead(id, recipientId);
    if (!notice)
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Notificação não encontrada.',
      );
    return toPhotoCommentNotification(notice);
  }

  /** Leitura em lote do snapshot de não lidos de um destinatário verificado. */
  async markAllReadFor(recipientId: string): Promise<number> {
    return this.repository.markAllRead(recipientId);
  }
}
