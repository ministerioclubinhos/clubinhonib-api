import { EmailModule } from 'src/shared/email';
import { SiteUrlModule } from 'src/shared/site-url';
import { CreatePhotoCommentRejectionEmailService } from './services/create-photo-comment-rejection-email.service';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/core/auth/auth.module';
import { UserModule } from 'src/core/user/user.module';
import { FeatureFlagsCoreModule } from 'src/core/feature-flags/feature-flags-core.module';
import { ImageModule } from 'src/modules/pages/image-page/image-page.module';
import { FeedPhotoCommentEntity } from './entities/feed-photo-comment.entity';
import { PhotoCommentNotificationEntity } from './entities/photo-comment-notification.entity';
import { FeedPhotoCommentsController } from './feed-photo-comments.controller';
import { FeedPhotoCommentsRepository } from './repositories/feed-photo-comments.repository';
import { CreateFeedPhotoCommentService } from './services/create-feed-photo-comment.service';
import { GetFeedPhotoCommentsService } from './services/get-feed-photo-comments.service';
import { UpdateFeedPhotoCommentService } from './services/update-feed-photo-comment.service';
import { DeleteFeedPhotoCommentService } from './services/delete-feed-photo-comment.service';
import { GetPhotoCommentNotificationsService } from './services/get-photo-comment-notifications.service';
import { UpdatePhotoCommentNotificationsService } from './services/update-photo-comment-notifications.service';
import { PhotoCommentNotificationsRepository } from './repositories/photo-comment-notifications.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FeedPhotoCommentEntity,
      PhotoCommentNotificationEntity,
    ]),
    AuthModule,
    UserModule,
    FeatureFlagsCoreModule,
    ImageModule,
    EmailModule,
    SiteUrlModule,
  ],
  controllers: [FeedPhotoCommentsController],
  providers: [
    FeedPhotoCommentsRepository,
    CreateFeedPhotoCommentService,
    GetFeedPhotoCommentsService,
    UpdateFeedPhotoCommentService,
    DeleteFeedPhotoCommentService,
    GetPhotoCommentNotificationsService,
    UpdatePhotoCommentNotificationsService,
    PhotoCommentNotificationsRepository,
    CreatePhotoCommentRejectionEmailService,
  ],
  /** Contratos públicos consumidos pela central de notificações. */
  exports: [
    GetPhotoCommentNotificationsService,
    UpdatePhotoCommentNotificationsService,
  ],
})
export class FeedPhotoCommentsModule {}
