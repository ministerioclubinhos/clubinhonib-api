import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RouteModule } from 'src/modules/routes/route.module';
import { MediaModule } from 'src/shared/media/media.module';

import { VideosPage } from './entities/video-page.entity';
import { VideosPageController } from './video-page.controller';
import { VideosPageRepository } from './repositories/video-page.repository';
import { CreateVideosPageService } from './services/create-video-page.service';
import { GetVideosPageService } from './services/get-video-page.service';
import { UpdateVideosPageService } from './services/update-video-page.service';
import { DeleteVideosPageService } from './services/delete-video-page.service';

@Module({
  imports: [TypeOrmModule.forFeature([VideosPage]), RouteModule, MediaModule],
  controllers: [VideosPageController],
  providers: [
    VideosPageRepository,
    CreateVideosPageService,
    GetVideosPageService,
    UpdateVideosPageService,
    DeleteVideosPageService,
  ],
  exports: [GetVideosPageService],
})
export class VideosPageModule {}
