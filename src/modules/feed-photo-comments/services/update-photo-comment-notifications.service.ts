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
    const notice = await this.repository.markRead(id, actor.userId);
    if (!notice)
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Notificação não encontrada.',
      );
    return toPhotoCommentNotification(notice);
  }
}
