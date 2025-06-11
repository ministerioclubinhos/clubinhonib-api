import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ImagePageEntity } from '../image-page/entity/Image-page.entity';
import { ImageSectionRepository } from './repository/image-section.repository';
import { ImagePageRepository } from '../image-page/repository/image-page.repository';
import { MediaModule } from 'src/share/media/media.module';
import { ImageSectionEntity } from '../image-page/entity/Image-section.entity';
import { AwsModule } from 'src/aws/aws.module';
import { ImageSectionUpdateService } from './services/image-section-update-service';
import { ImageSectionDeleteService } from './services/image-section-delete-service';
import { ImageSectionGetService } from './services/image-section-get-service';
import { ImageSectionController } from './Image-section-controller';
import { ImageSectionCreateService } from './services/Image-section-create-service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImageSectionEntity,
      ImagePageEntity
    ]),
    MediaModule,
    AwsModule,
  ],
  controllers: [ImageSectionController],
  providers: [
    ImageSectionRepository,
    ImagePageRepository,
    ImageSectionCreateService,
    ImageSectionDeleteService,
    ImageSectionGetService,
    ImageSectionUpdateService,
  ],
})
export class ImageSectionModule {}
