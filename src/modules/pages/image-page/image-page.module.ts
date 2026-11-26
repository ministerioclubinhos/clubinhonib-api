import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RouteModule } from 'src/modules/routes/route.module';
import { MediaModule } from 'src/shared/media/media.module';
import { AuthModule } from 'src/core/auth/auth.module';

import { ImagePageEntity } from './entity/Image-page.entity';
import { ImageSectionEntity } from './entity/Image-section.entity';
import { ImageSectionCelebrationEntity } from './entity/Image-section-celebration.entity';
import { ImageController } from './image-page.controller';
import { ImagePageRepository } from './repositories/image-page.repository';
import { ImageSectionCelebrationsRepository } from './repositories/image-section-celebrations.repository';
import { UpdateImageSectionCelebrationService } from './services/update-image-section-celebration.service';
import { ImagePageCreateService } from './services/create-image-page.service';
import { ImagePageGetService } from './services/get-image-page.service';
import { ImagePageUpdateService } from './services/update-image-page.service';
import { ImagePageDeleteService } from './services/delete-image-page.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ImagePageEntity,
      ImageSectionEntity,
      ImageSectionCelebrationEntity,
    ]),
    RouteModule,
    MediaModule,
    AuthModule,
  ],
  controllers: [ImageController],
  providers: [
    ImagePageRepository,
    ImageSectionCelebrationsRepository,
    ImagePageGetService,
    ImagePageCreateService,
    UpdateImageSectionCelebrationService,
    ImagePageUpdateService,
    ImagePageDeleteService,
  ],
  exports: [
    ImagePageCreateService,
    ImagePageGetService,
    ImagePageUpdateService,
    ImagePageDeleteService,
  ],
})
export class ImageModule {}
