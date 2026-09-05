import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClubPeriodEntity } from './entities/club-period.entity';
import { ClubExceptionEntity } from './entities/club-exception.entity';
import { ClubControlLogEntity } from './entities/club-control-log.entity';
import { ClubEntity } from '../clubs/entities/club.entity';
import { ChildEntity } from '../children/entities/child.entity';
import { PagelaEntity } from '../pagelas/entities/pagela.entity';
import { ClubControlRepository } from './repositories/club-control.repository';
import { ClubControlService } from './services/club-control.service';
import { ClubControlController } from './controllers/club-control.controller';
import { AcademicWeekService } from './services/academic-week.service';
import { ClubStatusService } from './services/club-status.service';
import { ClubIndicatorsService } from './services/club-indicators.service';
import { ClubWeekCheckService } from './services/club-week-check.service';
import { EmailModule } from 'src/shared/email';
import { SiteUrlModule } from 'src/shared/site-url';
import { SchedulingModule } from 'src/shared/scheduling';
import { UserModule } from 'src/core/user/user.module';
import { ClubsModule } from 'src/modules/clubs/clubs.module';
import { CoordinatorProfilesModule } from 'src/modules/coordinator-profiles/coordinator-profiles.module';
import { PagelasModule } from 'src/modules/pagelas/pagelas.module';
import { AnnounceClubExceptionService } from './services/announce-club-exception.service';
import { NotifyMissingPagelaService } from './services/notify-missing-pagela.service';
import { NotifyCoordinatorSummaryService } from './services/notify-coordinator-summary.service';
import { MissingPagelaReminderJob } from './jobs/missing-pagela-reminder.job';
import { CoordinatorWeeklySummaryJob } from './jobs/coordinator-weekly-summary.job';

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
    // O aviso da exceção vai para a base; os dois jobs precisam do agendador,
    // dos destinatários de cada clubinho e da semana letiva das pagelas.
    EmailModule,
    SiteUrlModule,
    UserModule,
    SchedulingModule,
    forwardRef(() => ClubsModule),
    forwardRef(() => CoordinatorProfilesModule),
    forwardRef(() => PagelasModule),
  ],
  controllers: [ClubControlController],
  providers: [
    ClubControlService,
    ClubControlRepository,
    AcademicWeekService,
    ClubStatusService,
    ClubIndicatorsService,
    ClubWeekCheckService,
    AnnounceClubExceptionService,
    NotifyMissingPagelaService,
    NotifyCoordinatorSummaryService,
    MissingPagelaReminderJob,
    CoordinatorWeeklySummaryJob,
  ],
  exports: [
    ClubControlService,
    ClubControlRepository,
    AcademicWeekService,
    ClubStatusService,
    ClubIndicatorsService,
    ClubWeekCheckService,
    AnnounceClubExceptionService,
    NotifyMissingPagelaService,
    NotifyCoordinatorSummaryService,
    MissingPagelaReminderJob,
    CoordinatorWeeklySummaryJob,
  ],
})
export class ClubControlModule {}
