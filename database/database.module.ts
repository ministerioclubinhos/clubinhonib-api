import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseLoggerService } from './database-logger.service';
import { MeditationEntity } from '../src/modules/meditations/entities/meditation.entity';
import { DayEntity } from '../src/modules/meditations/entities/day.entity';
import { ImagePageEntity } from '../src/modules/pages/image-page/entity/Image-page.entity';
import { ImageSectionEntity } from '../src/modules/pages/image-page/entity/Image-section.entity';
import { RouteEntity } from '../src/modules/routes/route-page.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { PasswordResetTokenEntity } from 'src/core/auth/entities/password-reset-token.entity';
import { FeatureFlagEntity } from 'src/core/feature-flags/entities/feature-flag.entity';
import { PersonalData } from 'src/core/profile/entities/personal-data.entity';
import { UserPreferences } from 'src/core/profile/entities/user-preferences.entity';
import { VideosPage } from '../src/modules/pages/video-page/entities/video-page.entity';

import { WeekMaterialsPageEntity } from '../src/modules/pages/week-material-page/entities/week-material-page.entity';
import { MediaItemEntity } from '../src/shared/media/media-item/media-item.entity';
import { ContactEntity } from '../src/modules/contacts/contact.entity';
import { EventEntity } from '../src/modules/pages/event-page/entities/event.entity';
import { CommentEntity } from '../src/modules/comments/entity/comment.entity';
import { DocumentEntity } from '../src/modules/documents/entities/document.entity';
import { IdeasSectionEntity } from '../src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from '../src/modules/pages/ideas-page/entities/ideas-page.entity';
import { InformativeEntity } from '../src/modules/informatives/entities/informative.entity';
import { SiteFeedbackEntity } from '../src/modules/feedbacks/entity/site-feedback.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { CoordinatorProfileEntity } from 'src/modules/coordinator-profiles/entities/coordinator-profile.entity/coordinator-profile.entity';
import { AddressEntity } from 'src/modules/addresses/entities/address.entity/address.entity';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { PagelaEntity } from 'src/modules/pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from 'src/modules/accepted-christs/entities/accepted-christ.entity';
import { ClubPeriodEntity } from 'src/modules/club-control/entities/club-period.entity';
import { ClubExceptionEntity } from 'src/modules/club-control/entities/club-exception.entity';
import { ClubControlLogEntity } from 'src/modules/club-control/entities/club-control-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_FILE || '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('DatabaseModule');
        const dbConfig = {
          type: 'mysql' as const,
          host: configService.get<string>('DB_HOST', 'localhost'),
          port: configService.get<number>('DB_PORT', 3306),
          username: configService.get<string>('DB_USERNAME', 'root'),
          password: configService.get<string>('DB_PASSWORD', ''),
          database: configService.get<string>('DB_NAME', 'test'),
          entities: [
            EventEntity,
            ImagePageEntity,
            ImageSectionEntity,
            RouteEntity,
            UserEntity,
            PasswordResetTokenEntity,
            FeatureFlagEntity,
            PersonalData,
            UserPreferences,
            VideosPage,
            WeekMaterialsPageEntity,
            MeditationEntity,
            DayEntity,
            MediaItemEntity,
            ContactEntity,
            CommentEntity,
            DocumentEntity,
            IdeasPageEntity,
            IdeasSectionEntity,
            InformativeEntity,
            SiteFeedbackEntity,
            ClubEntity,
            TeacherProfileEntity,
            CoordinatorProfileEntity,
            AddressEntity,
            ChildEntity,
            PagelaEntity,
            AcceptedChristEntity,
            ClubPeriodEntity,
            ClubExceptionEntity,
            ClubControlLogEntity,
          ],
          synchronize: true,
        };

        logger.debug(`Tentando conectar ao banco de dados MySQL:
           → Host: ${dbConfig.host}
           → Porta: ${dbConfig.port}
           → DB: ${dbConfig.database}
           → Usuário: ${dbConfig.username}`);

        return dbConfig;
      },
    }),
  ],
  providers: [DatabaseLoggerService],
})
export class DatabaseModule { }
