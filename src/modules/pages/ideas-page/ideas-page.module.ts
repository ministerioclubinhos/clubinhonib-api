import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RouteModule } from 'src/modules/routes/route.module';
import { AwsModule } from 'src/shared/providers/aws/aws.module';
import { MediaModule } from 'src/shared/media/media.module';

import { IdeasPageEntity } from './entities/ideas-page.entity';
import { IdeasSectionEntity } from './entities/ideas-section.entity';
import { IdeasPageController } from './ideas-page.controller';
import { IdeasPageRepository } from './repositories/ideas-page.repository';
import { IdeasPageCreateService } from './services/create-ideas-page.service';
import { IdeasPageGetService } from './services/get-ideas-page.service';
import { IdeasPageUpdateService } from './services/update-ideas-page.service';
import { IdeasPageDeleteService } from './services/delete-ideas-page.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdeasPageEntity, IdeasSectionEntity]),
    RouteModule,
    AwsModule,
    MediaModule,
  ],
  controllers: [IdeasPageController],
  providers: [
    IdeasPageRepository,
    IdeasPageCreateService,
    IdeasPageGetService,
    IdeasPageUpdateService,
    IdeasPageDeleteService,
  ],
  exports: [
    IdeasPageCreateService,
    IdeasPageGetService,
    IdeasPageUpdateService,
    IdeasPageDeleteService,
  ],
})
export class IdeasPageModule {}
