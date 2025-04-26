import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VideosPage } from './entities/video-page.entity';
import { VideosPageController } from './video-page.controller';
import { VideosPageRepository } from './video-page.repository';
import { RouteModule } from 'src/route/route.module';
import { MediaModule } from 'src/share/media/media.module';
import { CreateVideosPageService } from './services/videos-page.create.service';
import { DeleteVideosPageService } from './services/videos-page.delete.service';
import { GetVideosPageService } from './services/videos-page.get.service';
import { UpdateVideosPageService } from './services/videos-page.update.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VideosPage]),
    RouteModule,
    MediaModule
  ],
  controllers: [VideosPageController],
  providers: [
    CreateVideosPageService, DeleteVideosPageService, GetVideosPageService, UpdateVideosPageService, VideosPageRepository,
  ],
})
export class VideosPageModule { }
