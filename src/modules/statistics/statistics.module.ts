import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { StatisticsRepository } from './statistics.repository';

// Entities
import { PagelaEntity } from '../pagelas/entities/pagela.entity';
import { AcceptedChristEntity } from '../accepted-christs/entities/accepted-christ.entity';
import { ChildEntity } from '../children/entities/child.entity';
import { ClubEntity } from '../clubs/entities/club.entity/club.entity';
import { TeacherProfileEntity } from '../teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';

// Club Control Entities (para integração com período letivo e exceções globais)
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
      ClubPeriodEntity,      // Período letivo GLOBAL
      ClubExceptionEntity,   // Exceções GLOBAIS
    ]),
  ],
  controllers: [StatisticsController],
  providers: [StatisticsService, StatisticsRepository],
  exports: [StatisticsService, StatisticsRepository],
})
export class StatisticsModule {}

