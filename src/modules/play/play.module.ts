import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsCoreModule } from 'src/core/feature-flags/feature-flags-core.module';
import { PlayVideoEntryEntity } from './entities/play-video-entry.entity';
import { PlayCategoryEntity } from './entities/play-category.entity';
import { PlayVideoViewEntity } from './entities/play-video-view.entity';
import { PlayVideoProgressEntity } from './entities/play-video-progress.entity';
import { PlayFavoriteEntity } from './entities/play-favorite.entity';
import { PlayVideoEntryRepository } from './repositories/play-video-entry.repository';
import { PlayCategoryRepository } from './repositories/play-category.repository';
import { PlayEngagementRepository } from './repositories/play-engagement.repository';
import { PlayAccessService } from './services/play-access.service';
import { SyncPlayEntriesService } from './services/sync-play-entries.service';
import { GetPlayVideosService } from './services/get-play-videos.service';
import { PlayCategoriesService } from './services/play-categories.service';
import { PlayEngagementService } from './services/play-engagement.service';
import { PlayController } from './play.controller';
import { PlayAdminController } from './play-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlayVideoEntryEntity,
      PlayCategoryEntity,
      PlayVideoViewEntity,
      PlayVideoProgressEntity,
      PlayFavoriteEntity,
    ]),
    FeatureFlagsCoreModule,
  ],
  controllers: [PlayController, PlayAdminController],
  providers: [
    PlayVideoEntryRepository,
    PlayCategoryRepository,
    PlayEngagementRepository,
    PlayAccessService,
    SyncPlayEntriesService,
    GetPlayVideosService,
    PlayCategoriesService,
    PlayEngagementService,
  ],
  exports: [SyncPlayEntriesService, GetPlayVideosService, PlayAccessService],
})
export class PlayModule {}
