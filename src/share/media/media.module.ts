import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MediaItemEntity } from './media-item/media-item.entity';
import { MediaItemProcessor } from './media-item-processor';
import { MediaItemRepository } from './media-item-repository';

@Module({
  imports: [TypeOrmModule.forFeature([MediaItemEntity])],
  providers: [MediaItemProcessor,MediaItemRepository],
  exports: [MediaItemProcessor], 
})
export class MediaModule {}
