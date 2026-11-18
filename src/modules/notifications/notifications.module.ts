import { Module } from '@nestjs/common';
import { AuthModule } from 'src/core/auth/auth.module';
import { FeatureFlagsCoreModule } from 'src/core/feature-flags/feature-flags-core.module';
import { FeedPhotoCommentsModule } from 'src/modules/feed-photo-comments/feed-photo-comments.module';
import { NotificationsController } from './notifications.controller';
import { GetNotificationsService } from './services/get-notifications.service';
import { UpdateNotificationsService } from './services/update-notifications.service';

/**
 * Fachada da central de notificações (sininho). Não tem tabela própria:
 * consulta as origens pelos contratos públicos de seus módulos.
 */
@Module({
  imports: [AuthModule, FeatureFlagsCoreModule, FeedPhotoCommentsModule],
  controllers: [NotificationsController],
  providers: [GetNotificationsService, UpdateNotificationsService],
})
export class NotificationsModule {}
