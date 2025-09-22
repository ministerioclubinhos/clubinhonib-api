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
import { IdeasSectionModule } from './pages/ideas-section/ideas-section.module';
import { SiteFeedbackModule } from './feedback/site-feedback.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { CoordinatorProfilesModule } from './modules/coordinator-profiles/coordinator-profiles.module';
import { TeacherProfilesModule } from './modules/teacher-profiles/teacher-profiles.module';
import { ClubsModule } from './modules/clubs/clubs.module';
import { ChildrenModule } from './modules/children/children.module';
import { PagelasModule } from './modules/pagelas/pagelas.module';
import { AcceptedChristsModule } from './modules/accepted-christs/accepted-christs.module';

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
    IdeasSectionModule,
    SiteFeedbackModule,
    AddressesModule,
    CoordinatorProfilesModule,
    TeacherProfilesModule,
    ClubsModule,
    ChildrenModule,
    PagelasModule,
    AcceptedChristsModule
  ],
})
export class AppModule { }
