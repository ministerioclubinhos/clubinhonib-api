import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { AttendanceStatisticsRepository } from './repositories/attendance-statistics.repository';
import { ChildrenStatisticsRepository } from './repositories/children-statistics.repository';
import { ClubsTeachersStatisticsRepository } from './repositories/clubs-teachers-statistics.repository';
import { PagelasStatisticsRepository } from './repositories/pagelas-statistics.repository';
import { OverviewStatisticsRepository } from './repositories/overview-statistics.repository';
import { AcceptedChristsStatisticsRepository } from './repositories/accepted-christs-statistics.repository';
import { StatisticsFiltersService } from './services/statistics-filters.service';
import { StatisticsPeriodService } from './services/statistics-period.service';
import { ClubControlModule } from '../club-control/club-control.module';

import { PagelaEntity } from '../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../accepted-christs/entities/accepted-christ.entity';
import { ChildEntity } from '../children/entities/child.entity';
import { ClubEntity } from '../clubs/entities/club.entity';
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
    // O serviço de semana letiva é do `club-control`: consumir o módulo dono
    // em vez de redeclarar o provider evita duas instâncias divergindo.
    ClubControlModule,
  ],
  controllers: [StatisticsController],
  providers: [
    StatisticsService,
    AttendanceStatisticsRepository,
    ChildrenStatisticsRepository,
    ClubsTeachersStatisticsRepository,
    PagelasStatisticsRepository,
    OverviewStatisticsRepository,
    AcceptedChristsStatisticsRepository,
    StatisticsFiltersService,
    StatisticsPeriodService,
  ],
  exports: [StatisticsService],
})
export class StatisticsModule {}
