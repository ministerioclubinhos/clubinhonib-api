import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RouteModule } from './route/route.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { AwsModule } from './aws/aws.module';
import { DatabaseModule } from '../database/database.module';
import { MeditationModule } from './meditation/meditation.module';
import { ImageModule } from './pages/image-page/image-page.module';
import { VideosPageModule } from './pages/video-page/video-page.module';
import { WeekMaterialsPageModule } from './pages/week-material-page/week-material-page.module';
import { ContactModule } from './contact/contact.module';
import { EventModule } from './pages/event-page/event.module';
import { CommentModule } from './comment/comment.module';
import { DocumentModule } from './documents/documents.module';
import { IdeasPageModule } from './pages/ideas-page/ideas-page.module';
import { InformativeModule } from './informative/informative.module';
import { ImageSectionModule } from './pages/image-section/image-section.module';
import { SiteFeedbackModule } from './feedback/site-feedback.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AwsModule,
    ImageModule,
    RouteModule,
    UserModule,
    AuthModule,
    VideosPageModule,
    WeekMaterialsPageModule,
    MeditationModule,
    ContactModule,
    EventModule,
    CommentModule,
    DocumentModule,
    IdeasPageModule,
    InformativeModule,
    ImageSectionModule,
    SiteFeedbackModule
  ],
})
export class AppModule { }
