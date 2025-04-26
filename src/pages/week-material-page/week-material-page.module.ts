import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WeekMaterialsPageRepository } from './week-material.repository';
import { WeekMaterialsPageEntity } from './entities/week-material-page.entity';
import { RouteModule } from 'src/route/route.module';
import { MediaModule } from 'src/share/media/media.module';
import { WeekMaterialsPageController } from './week-material-page.controller';
import { WeekMaterialsPageCreateService } from './services/WeekMaterialsPageCreateService';
import { WeekMaterialsPageUpdateService } from './services/WeekMaterialsPageUpdateService';
import { WeekMaterialsPageRemoveService } from './services/WeekMaterialsPageRemoveService';
import { WeekMaterialsPageGetService } from './services/WeekMaterialsPageGetService';
@Module({
  imports: [
    TypeOrmModule.forFeature([WeekMaterialsPageEntity]),
    RouteModule,
    MediaModule,
  ],
  controllers: [WeekMaterialsPageController],
  providers: [
    WeekMaterialsPageRepository,
    WeekMaterialsPageCreateService,
    WeekMaterialsPageUpdateService,
    WeekMaterialsPageRemoveService,
    WeekMaterialsPageGetService,
  ],
  exports: [TypeOrmModule], // Exporta o TypeOrmModule para uso em outros módulos, se necessário
})
export class WeekMaterialsPageModule {}