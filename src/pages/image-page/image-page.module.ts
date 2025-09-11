import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RouteModule } from 'src/route/route.module';
import { ImagePageEntity } from './entity/Image-page.entity';
import { ImageSectionEntity } from './entity/Image-section.entity';
import { ImageController } from './image-page.controller';
import { ImagePageRepository } from './repository/image-page.repository';
import { ImageSectionRepository } from '../image-section/repository/image-section.repository';
import { MediaModule } from 'src/share/media/media.module';
import { ImagePageCreateService } from './services/ImagePageCreateService';
import { ImagePageGetService } from './services/ImagePageGetService';
import { ImagePageDeleteService } from './services/ImagePageDeleteService';
import { ImagePageUpdateService } from './services/ImagePageUpdateService';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImagePageEntity, ImageSectionEntity, ImagePageEntity]),
    RouteModule,
    MediaModule,
    AuthModule
  ],
  controllers: [ImageController],
  providers: [
    ImagePageCreateService, ImagePageGetService, ImagePageDeleteService, ImagePageUpdateService,
    {
      provide: ImagePageRepository,
      useFactory: (dataSource: DataSource) => new ImagePageRepository(dataSource),
      inject: [DataSource],
    },
    {
      provide: ImageSectionRepository,
      useFactory: (dataSource: DataSource) => new ImageSectionRepository(dataSource),
      inject: [DataSource],
    },
  ],
  exports: [ImagePageCreateService, ImagePageGetService, ImagePageDeleteService, ImagePageUpdateService],
})
export class ImageModule { }
