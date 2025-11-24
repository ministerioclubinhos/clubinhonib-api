import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { StatisticsRepository } from './statistics.repository';
import { StatisticsFiltersService } from './services/statistics-filters.service';
import { StatisticsCalculationsService } from './services/statistics-calculations.service';

import { PagelaEntity } from '../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../accepted-christs/entities/accepted-christ.entity';
import { ChildEntity } from '../children/entities/child.entity';
import { ClubEntity } from '../clubs/entities/club.entity/club.entity';
import { TeacherProfileEntity } from '../teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { ClubPeriodEntity } from '../club-control/entities/club-period.entity';
import { ClubExceptionEntity } from '../club-control/entities/club-exception.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PagelaEntity,
      AcceptedChristEntity,
      ChildEntity,
      ClubEntity,
      TeacherProfileEntity,
      ClubPeriodEntity,
      ClubExceptionEntity,
    ]),
  ],
  controllers: [StatisticsController],
  providers: [
    StatisticsService,
    StatisticsRepository,
    StatisticsFiltersService,
    StatisticsCalculationsService,
  ],
  exports: [StatisticsService, StatisticsRepository],
})
export class StatisticsModule {}

