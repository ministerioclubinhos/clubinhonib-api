import { Injectable } from '@nestjs/common';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { PhotoCommentNotificationsRepository } from '../repositories/photo-comment-notifications.repository';
import { GetFeedPhotoCommentsService } from './get-feed-photo-comments.service';
import {
  PhotoCommentNotificationDto,
  PhotoCommentNotificationsPageDto,
  PhotoCommentNotificationSummaryDto,
} from '../dto/photo-comment-notification.dto';
import { QueryPhotoCommentsDto } from '../dto/query-photo-comments.dto';
import {
  PhotoCommentActor,
  PhotoCommentInboxAccess,
  PhotoCommentNotificationPageQuery,
} from '../types';
import {
  toPhotoCommentNotification,
  toPhotoCommentNotificationRecent,
} from '../utils';

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

  /**
   * Usado pela central comum: conta inativa continua sendo erro
   * (`USER_INACTIVE`), mas a origem desligada por flag apenas fica
   * indisponível, para a central omiti-la sem falhar.
   */
  async resolveInboxAccess(userId: string): Promise<PhotoCommentInboxAccess> {
    const actor = await this.comments.requireActiveActor(userId);
    const available = await this.comments.isFeatureEnabled(
      FeatureFlagKeys.CLUBINHO_FEED,
      actor.role,
    );
    return { actor, available };
  }

  async findMine(
    query: QueryPhotoCommentsDto,
    userId: string,
  ): Promise<PhotoCommentNotificationsPageDto> {
    const actor = await this.requireActor(userId);
    return this.findPageFor(actor.userId, { ...query, unreadOnly: false });
  }

  /** Página da inbox de um destinatário cujo acesso já foi verificado. */
  async findPageFor(
    recipientId: string,
    query: PhotoCommentNotificationPageQuery,
  ): Promise<PhotoCommentNotificationsPageDto> {
    const [[rows, total], unreadCount] = await Promise.all([
      this.repository.findPage(recipientId, query),
      this.repository.countUnread(recipientId),
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

  async findOneFor(
    id: string,
    recipientId: string,
  ): Promise<PhotoCommentNotificationDto> {
    const notice = await this.repository.findOwned(id, recipientId);
    if (!notice)
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Notificação não encontrada.',
      );
    return toPhotoCommentNotification(notice);
  }

  async summarizeFor(
    recipientId: string,
  ): Promise<PhotoCommentNotificationSummaryDto> {
    const [aggregate, recent] = await Promise.all([
      this.repository.aggregate(recipientId),
      this.repository.findRecentUnread(recipientId),
    ]);
    return {
      ...aggregate,
      recentUnread: recent.map(toPhotoCommentNotificationRecent),
    };
  }
}
