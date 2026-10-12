import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RouteModule } from 'src/modules/routes/route.module';
import { MediaModule } from 'src/shared/media/media.module';
import { EmailModule } from 'src/shared/email';
import { SiteUrlModule } from 'src/shared/site-url';
import { UserModule } from 'src/core/user/user.module';

import { WeekMaterialsPageEntity } from './entities/week-material-page.entity';
import { WeekMaterialsPageRepository } from './repositories/week-material-page.repository';
import { WeekMaterialsPageController } from './week-material-page.controller';
import { WeekMaterialsPageCreateService } from './services/create-week-material.service';
import { WeekMaterialsPageGetService } from './services/get-week-material.service';
import { WeekMaterialsPageUpdateService } from './services/update-week-material.service';
import { WeekMaterialsPageRemoveService } from './services/delete-week-material.service';
import { AnnounceWeekMaterialService } from './services/announce-week-material.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([WeekMaterialsPageEntity]),
    RouteModule,
    MediaModule,
    EmailModule,
    SiteUrlModule,
    UserModule,
  ],
  controllers: [WeekMaterialsPageController],
  providers: [
    WeekMaterialsPageRepository,
    WeekMaterialsPageCreateService,
    WeekMaterialsPageGetService,
    WeekMaterialsPageUpdateService,
    WeekMaterialsPageRemoveService,
    AnnounceWeekMaterialService,
  ],
  exports: [
    TypeOrmModule,
    WeekMaterialsPageGetService,
    WeekMaterialsPageCreateService,
  ],
})
export class WeekMaterialsPageModule {}
