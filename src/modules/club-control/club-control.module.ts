import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubPeriodEntity } from './entities/club-period.entity';
import { ClubExceptionEntity } from './entities/club-exception.entity';
import { ClubControlLogEntity } from './entities/club-control-log.entity';
import { ClubEntity } from '../clubs/entities/club.entity/club.entity';
import { ChildEntity } from '../children/entities/child.entity';
import { PagelaEntity } from '../pagelas/entities/pagela.entity';
import { ClubControlRepository } from './repositories/club-control.repository';
import { ClubControlService } from './services/club-control.service';
import { ClubControlController } from './controllers/club-control.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClubPeriodEntity,
      ClubExceptionEntity,
      ClubControlLogEntity,
      ClubEntity,
      ChildEntity,
      PagelaEntity,
    ]),
  ],
  controllers: [ClubControlController],
  providers: [ClubControlService, ClubControlRepository],
  exports: [ClubControlService, ClubControlRepository],
})
export class ClubControlModule {}

