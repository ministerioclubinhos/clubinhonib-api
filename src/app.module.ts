import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RouteModule } from './modules/routes/route.module';
import { UserModule } from './core/user/user.module';
import { AuthModule } from './core/auth/auth.module';
import { AwsModule } from './shared/providers/aws/aws.module';
import { TwilioModule } from './shared/providers/twilio/twilio.module';
import { NotificationModule } from './shared/providers/notification/notification.module';
import { DatabaseModule } from '../database/database.module';
import { MeditationModule } from './modules/meditations/meditation.module';
import { ImageModule } from './modules/pages/image-page/image-page.module';
import { VideosPageModule } from './modules/pages/video-page/video-page.module';
import { WeekMaterialsPageModule } from './modules/pages/week-material-page/week-material-page.module';
import { ContactModule } from './modules/contacts/contact.module';
import { EventModule } from './modules/pages/event-page/event.module';
import { CommentModule } from './modules/comments/comment.module';
import { DocumentModule } from './modules/documents/documents.module';
import { IdeasPageModule } from './modules/pages/ideas-page/ideas-page.module';
import { InformativeModule } from './modules/informatives/informative.module';
import { ImageSectionModule } from './modules/pages/image-section/image-section.module';
import { IdeasSectionModule } from './modules/pages/ideas-section/ideas-section.module';
import { SiteFeedbackModule } from './modules/feedbacks/site-feedback.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { CoordinatorProfilesModule } from './modules/coordinator-profiles/coordinator-profiles.module';
import { TeacherProfilesModule } from './modules/teacher-profiles/teacher-profiles.module';
import { ClubsModule } from './modules/clubs/clubs.module';
import { ChildrenModule } from './modules/children/children.module';
import { PagelasModule } from './modules/pagelas/pagelas.module';
import { AcceptedChristsModule } from './modules/accepted-christs/accepted-christs.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { ClubControlModule } from './modules/club-control/club-control.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: process.env.ENV_FILE || '.env',
    }),
    DatabaseModule,
    AwsModule,
    TwilioModule,
    NotificationModule,
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
    IdeasSectionModule,
    SiteFeedbackModule,
    AddressesModule,
    CoordinatorProfilesModule,
    TeacherProfilesModule,
    ClubsModule,
    ChildrenModule,
    PagelasModule,
    AcceptedChristsModule,
    StatisticsModule,
    ClubControlModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
