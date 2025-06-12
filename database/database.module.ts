import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DatabaseLoggerService } from './database-logger.service';
import { MeditationEntity } from 'src/meditation/entities/meditation.entity';
import { DayEntity } from 'src/meditation/entities/day.entity';
import { ImagePageEntity } from 'src/pages/image-page/entity/Image-page.entity';
import { ImageSectionEntity } from 'src/pages/image-page/entity/Image-section.entity';
import { RouteEntity } from 'src/route/route-page.entity';
import { User } from 'src/user/user.entity';
import { VideosPage } from 'src/pages/video-page/entities/video-page.entity';

import { WeekMaterialsPageEntity } from 'src/pages/week-material-page/entities/week-material-page.entity';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { ContactEntity } from 'src/contact/contact.entity';
import { EventEntity } from 'src/pages/event-page/entities/event.entity';
import { CommentEntity } from 'src/comment/entity/comment.entity';
import { DocumentEntity } from 'src/documents/entities/document.entity';
import { IdeasSectionEntity } from 'src/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from 'src/pages/ideas-page/entities/ideas-page.entity';
import { InformativeEntity } from 'src/informative/entities/informative.entity';
import { SiteFeedbackEntity } from 'src/feedback/entity/site-feedback.entity';
;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
            User,
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
            SiteFeedbackEntity
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
