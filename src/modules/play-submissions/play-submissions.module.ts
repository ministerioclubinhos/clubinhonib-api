import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaModule } from 'src/shared/media/media.module';
import { VideosPageModule } from 'src/modules/pages/video-page/video-page.module';
import { PlayModule } from 'src/modules/play/play.module';
import { PlaySubmissionEntity } from './entities/play-submission.entity';
import { PlaySubmissionRepository } from './repositories/play-submission.repository';
import { CreatePlaySubmissionService } from './services/create-play-submission.service';
import { GetPlaySubmissionsService } from './services/get-play-submissions.service';
import { DeletePlaySubmissionService } from './services/delete-play-submission.service';
import { ReviewPlaySubmissionService } from './services/review-play-submission.service';
import { PlaySubmissionsController } from './play-submissions.controller';
import { PlaySubmissionsAdminController } from './play-submissions-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([PlaySubmissionEntity]),
    MediaModule,
    VideosPageModule,
    PlayModule,
  ],
  controllers: [PlaySubmissionsController, PlaySubmissionsAdminController],
  providers: [
    PlaySubmissionRepository,
    CreatePlaySubmissionService,
    GetPlaySubmissionsService,
    DeletePlaySubmissionService,
    ReviewPlaySubmissionService,
  ],
})
export class PlaySubmissionsModule {}
