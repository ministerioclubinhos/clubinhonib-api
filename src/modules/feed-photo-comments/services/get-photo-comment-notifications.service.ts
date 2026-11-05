import { Injectable } from '@nestjs/common';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { PhotoCommentNotificationsRepository } from '../repositories/photo-comment-notifications.repository';
import { GetFeedPhotoCommentsService } from './get-feed-photo-comments.service';
import { PhotoCommentNotificationsPageDto } from '../dto/photo-comment-notification.dto';
import { QueryPhotoCommentsDto } from '../dto/query-photo-comments.dto';
import { PhotoCommentActor } from '../types';
import { toPhotoCommentNotification } from '../utils';

@Injectable()
export class GetPhotoCommentNotificationsService {
  constructor(
    private readonly repository: PhotoCommentNotificationsRepository,
    private readonly comments: GetFeedPhotoCommentsService,
  ) {}

  async requireActor(userId: string): Promise<PhotoCommentActor> {
    const actor = await this.comments.requireActiveActor(userId);
    await this.comments.requireFeature(
      FeatureFlagKeys.CLUBINHO_FEED,
      actor.role,
    );
    return actor;
  }

  async findMine(
    query: QueryPhotoCommentsDto,
    userId: string,
  ): Promise<PhotoCommentNotificationsPageDto> {
    const actor = await this.requireActor(userId);
    const [[rows, total], unreadCount] = await Promise.all([
      this.repository.findPage(actor.userId, query),
      this.repository.countUnread(actor.userId),
    ]);
    const page = new PhotoCommentNotificationsPageDto(
      rows.map(toPhotoCommentNotification),
      total,
      query.page,
      query.limit,
    );
    page.unreadCount = unreadCount;
    return page;
  }
}
