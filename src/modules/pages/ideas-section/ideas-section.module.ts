import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AwsModule } from 'src/shared/providers/aws/aws.module';
import { MediaModule } from 'src/shared/media/media.module';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from 'src/modules/pages/ideas-page/entities/ideas-page.entity';

import { IdeasSectionController } from './ideas-section.controller';
import { IdeasSectionsRepository } from './repositories/ideas-sections.repository';
import { CreateIdeasSectionService } from './services/create-ideas-section.service';
import { GetIdeasSectionsService } from './services/get-ideas-sections.service';
import { UpdateIdeasSectionService } from './services/update-ideas-section.service';
import { AttachIdeasSectionService } from './services/attach-ideas-section.service';
import { DeleteIdeasSectionService } from './services/delete-ideas-section.service';
import { IdeasSectionMediaService } from './services/ideas-section-media.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([IdeasSectionEntity, IdeasPageEntity]),
    AwsModule,
    MediaModule,
  ],
  controllers: [IdeasSectionController],
  providers: [
    IdeasSectionsRepository,
    IdeasSectionMediaService,
    CreateIdeasSectionService,
    GetIdeasSectionsService,
    UpdateIdeasSectionService,
    AttachIdeasSectionService,
    DeleteIdeasSectionService,
  ],
  exports: [GetIdeasSectionsService],
})
export class IdeasSectionModule {}
