import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RouteModule } from 'src/modules/routes/route.module';
import { MediaModule } from 'src/shared/media/media.module';
import { EmailModule } from 'src/shared/email';
import { SiteUrlModule } from 'src/shared/site-url';
import { UserModule } from 'src/core/user/user.module';
import { AuthModule } from 'src/core/auth/auth.module';
import { ClubControlModule } from 'src/modules/club-control/club-control.module';

import { EventEntity } from './entities/event.entity';
import { EventRepository } from './repositories/event.repository';
import { EventController } from './event.controller';
import { CreateEventService } from './services/create-event.service';
import { GetEventService } from './services/get-event.service';
import { UpdateEventService } from './services/update-event.service';
import { DeleteEventService } from './services/delete-event.service';
import { AnnounceEventService } from './services/announce-event.service';
import { SyncClubEventService } from './services/sync-club-event.service';
import { ClubMeetingScheduleService } from './services/club-meeting-schedule.service';
import { ReconcileClubEventsService } from './services/reconcile-club-events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventEntity]),
    RouteModule,
    MediaModule,
    EmailModule,
    SiteUrlModule,
    forwardRef(() => UserModule),
    forwardRef(() => AuthModule),
    // O período letivo e as exceções decidem em que dias um encontro de
    // clubinho acontece. `forwardRef` porque controle depende de clubes, e
    // clubes depende desta agenda para manter o encontro sincronizado.
    forwardRef(() => ClubControlModule),
  ],
  controllers: [EventController],
  providers: [
    EventRepository,
    CreateEventService,
    GetEventService,
    UpdateEventService,
    DeleteEventService,
    AnnounceEventService,
    SyncClubEventService,
    ClubMeetingScheduleService,
    ReconcileClubEventsService,
  ],
  exports: [
    GetEventService,
    SyncClubEventService,
    ClubMeetingScheduleService,
    ReconcileClubEventsService,
  ],
})
export class EventModule {}
