import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RouteModule } from 'src/modules/routes/route.module';
import { MediaModule } from 'src/shared/media/media.module';

import { MeditationController } from './meditation.controller';
import { MeditationEntity } from './entities/meditation.entity';
import { DayEntity } from './entities/day.entity';
import { MeditationRepository } from './repositories/meditation.repository';
import { CreateMeditationService } from './services/create-meditation.service';
import { GetMeditationService } from './services/get-meditation.service';
import { UpdateMeditationService } from './services/update-meditation.service';
import { DeleteMeditationService } from './services/delete-meditation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeditationEntity, DayEntity]),
    forwardRef(() => RouteModule),
    MediaModule,
  ],
  controllers: [MeditationController],
  providers: [
    MeditationRepository,
    CreateMeditationService,
    GetMeditationService,
    UpdateMeditationService,
    DeleteMeditationService,
  ],
  exports: [GetMeditationService],
})
export class MeditationModule {}
