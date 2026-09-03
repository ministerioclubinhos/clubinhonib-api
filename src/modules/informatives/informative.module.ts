import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InformativeEntity } from './entities/informative.entity';
import { InformativesRepository } from './repositories/informatives.repository';
import { InformativeController } from './informative.controller';

import { CreateInformativeService } from './services/create-informative.service';
import { GetInformativeService } from './services/get-informative.service';
import { UpdateInformativeService } from './services/update-informative.service';
import { DeleteInformativeService } from './services/delete-informative.service';

import { RouteService } from 'src/modules/routes/route.service';
import { RouteRepository } from 'src/modules/routes/route-page.repository';
import { MeditationModule } from 'src/modules/meditations/meditation.module';

@Module({
  imports: [TypeOrmModule.forFeature([InformativeEntity]), MeditationModule],
  controllers: [InformativeController],
  providers: [
    CreateInformativeService,
    GetInformativeService,
    UpdateInformativeService,
    DeleteInformativeService,
    RouteService,
    InformativesRepository,
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
