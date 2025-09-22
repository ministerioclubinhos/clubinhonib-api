import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IdeasSectionController } from './ideas-section.controller';
import { IdeasSectionCreateService } from './services/ideas-section-create.service';
import { IdeasSectionUpdateService } from './services/ideas-section-update.service';
import { IdeasSectionGetService } from './services/ideas-section-get.service';
import { IdeasSectionDeleteService } from './services/ideas-section-delete.service';
import { IdeasSectionRepository } from './repository/ideas-section.repository';
import { IdeasSectionEntity } from '../ideas-page/entities/ideas-section.entity';
import { AwsModule } from 'src/aws/aws.module';
import { MediaModule } from 'src/share/media/media.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdeasSectionEntity]),
    AwsModule,
    MediaModule,
  ],
  controllers: [IdeasSectionController],
  providers: [
    IdeasSectionCreateService,
    IdeasSectionUpdateService,
    IdeasSectionGetService,
    IdeasSectionDeleteService,
    IdeasSectionRepository,
  ],
  exports: [
    IdeasSectionRepository,
    IdeasSectionGetService,
  ],
})
export class IdeasSectionModule { }
