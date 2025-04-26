import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdeasPageController } from './ideas-page.controller';
import { IdeasPageEntity } from './entities/ideas-page.entity';
import { IdeasSectionEntity } from './entities/ideas-section.entity';
import { IdeasPageRepository } from './repositories/ideas-page.repository';
import { IdeasPageCreateService } from './services/ideas-page-create.service';
import { RouteModule } from 'src/route/route.module';
import { AwsModule } from 'src/aws/aws.module';
import { MediaModule } from 'src/share/media/media.module';
import { IdeasPageRemoveService } from './services/ideas-page-remove.service';
import { IdeasPageGetService } from './services/ideas-page-get.service';
import { IdeasPageUpdateService } from './services/ideas-page-update.service';
import { IdeasSectionRepository } from './repositories/ideas-section.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdeasPageEntity, IdeasSectionEntity]),
    RouteModule,
    AwsModule,
    MediaModule,
  ],
  controllers: [IdeasPageController],
  providers: [
    IdeasPageCreateService,
    IdeasPageRepository,
    IdeasSectionEntity,
    IdeasPageRemoveService,
    IdeasPageGetService,
    IdeasPageUpdateService,
    IdeasSectionRepository
  ],
})
export class IdeasPageModule { }
