import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { InformativeEntity } from './entities/informative.entity';
import { InformativeRepository } from './informative.repository';
import { InformativeController } from './informative.controller';

import { CreateInformativeService } from './services/create-informative.service';
import { GetInformativeService } from './services/get-informative.service';
import { UpdateInformativeService } from './services/update-informative.service';
import { DeleteInformativeService } from './services/delete-informative.service';

import { RouteService } from 'src/route/route.service';
import { RouteRepository } from 'src/route/route-page.repository';
import { MeditationModule } from 'src/meditation/meditation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InformativeEntity]),
    MeditationModule,
  ],
  controllers: [InformativeController],
  providers: [
    CreateInformativeService,
    GetInformativeService,
    UpdateInformativeService,
    DeleteInformativeService,
    RouteService,
    {
      provide: InformativeRepository,
      useFactory: (dataSource: DataSource) =>
        new InformativeRepository(dataSource),
      inject: [DataSource],
    },
    RouteRepository,
  ],
  exports: [
    CreateInformativeService,
    GetInformativeService,
    UpdateInformativeService,
    DeleteInformativeService,
  ],
})
export class InformativeModule {}
