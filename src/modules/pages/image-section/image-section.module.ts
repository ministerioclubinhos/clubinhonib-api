import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MediaModule } from 'src/shared/media/media.module';
import { AwsModule } from 'src/shared/providers/aws/aws.module';

import { ImagePageEntity } from '../image-page/entity/Image-page.entity';
import { ImageSectionEntity } from '../image-page/entity/Image-section.entity';
import { ImagePageRepository } from '../image-page/repositories/image-page.repository';

import { ImageSectionController } from './image-section.controller';
import { ImageSectionRepository } from './repository/image-section.repository';
import { ImageSectionsRepository } from './repositories/image-sections.repository';
import { ImageSectionCreateService } from './services/create-image-section.service';
import { GetImageSectionsService } from './services/get-image-sections.service';
import { ImageSectionUpdateService } from './services/update-image-section.service';
import { ImageSectionDeleteService } from './services/delete-image-section.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageSectionEntity, ImagePageEntity]),
    MediaModule,
    AwsModule,
  ],
  controllers: [ImageSectionController],
  providers: [
    ImageSectionsRepository,
    ImageSectionRepository,
    ImagePageRepository,
    ImageSectionCreateService,
    GetImageSectionsService,
    ImageSectionUpdateService,
    ImageSectionDeleteService,
  ],
  exports: [GetImageSectionsService],
})
export class ImageSectionModule {}
