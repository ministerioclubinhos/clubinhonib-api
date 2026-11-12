import { Injectable } from '@nestjs/common';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { GetPhotoCommentNotificationsService } from 'src/modules/feed-photo-comments/services/get-photo-comment-notifications.service';
import {
  AppForbiddenException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import {
  NOTIFICATION_CENTER_DISABLED_MESSAGE,
  NOTIFICATION_NOT_FOUND_MESSAGE,
} from '../constants';
import {
  NotificationDetailDto,
  NotificationsPageDto,
  NotificationSummaryDto,
} from '../dto/notification-response.dto';
import { QueryNotificationsDto } from '../dto/query-notifications.dto';
import { NotificationAccess } from '../types';
import {
  emptyPage,
  fromFeedNoticeDetail,
  fromFeedPage,
  fromFeedSummary,
  includesFeedSource,
  isUnreadFilter,
} from '../utils';

@Injectable()
export class GetNotificationsService {
  constructor(
    private readonly feed: GetPhotoCommentNotificationsService,
    private readonly flags: GetFeatureFlagsService,
  ) {}

  /**
   * Destinatário sempre vem da sessão. Conta inativa preserva `USER_INACTIVE`;
   * a central desligada por flag responde `FEATURE_DISABLED`; uma origem
   * desligada só é omitida.
   */
  async resolveAccess(userId: string): Promise<NotificationAccess> {
    const { actor, available } = await this.feed.resolveInboxAccess(userId);
    const centerEnabled = await this.flags.isEnabled(
      FeatureFlagKeys.NOTIFICATION_CENTER_V2,
      actor.role,
    );
    if (!centerEnabled)
      throw new AppForbiddenException(
        ErrorCode.FEATURE_DISABLED,
        NOTIFICATION_CENTER_DISABLED_MESSAGE,
      );
    return {
      recipientId: actor.userId,
      role: actor.role,
      feedAvailable: available,
    };
  }

  async summary(userId: string): Promise<NotificationSummaryDto> {
    const access = await this.resolveAccess(userId);
    return this.summaryFor(access);
  }

  async summaryFor(
    access: NotificationAccess,
  ): Promise<NotificationSummaryDto> {
    const feed = access.feedAvailable
      ? await this.feed.summarizeFor(access.recipientId)
      : null;
    return fromFeedSummary(feed);
  }

  async list(
    query: QueryNotificationsDto,
    userId: string,
  ): Promise<NotificationsPageDto> {
    const access = await this.resolveAccess(userId);
    if (!access.feedAvailable) return emptyPage(query);
    const page = await this.feed.findPageFor(access.recipientId, {
      page: query.page,
      limit: query.limit,
      unreadOnly: isUnreadFilter(query),
    });
    if (!includesFeedSource(query)) return emptyPage(query, page.unreadCount);
    return fromFeedPage(page);
  }

  async detail(id: string, userId: string): Promise<NotificationDetailDto> {
    const access = await this.resolveAccess(userId);
    if (!access.feedAvailable)
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        NOTIFICATION_NOT_FOUND_MESSAGE,
      );
    const notice = await this.feed.findOneFor(id, access.recipientId);
    return fromFeedNoticeDetail(notice);
  }
}
