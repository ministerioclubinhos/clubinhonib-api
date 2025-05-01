import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventRepository } from './event.repository';
import { EventController } from './event.controller';
import { EventEntity } from './entities/event.entity';
import { CreateEventService } from './services/create-event-service';
import { UpdateEventService } from './services/update-event-service';
import { DeleteEventService } from './services/delete-event-service';
import { GetEventService } from './services/get-event-service';
import { RouteModule } from 'src/route/route.module';
import { MediaModule } from 'src/share/media/media.module';

@Module({
  imports: [TypeOrmModule.forFeature([EventEntity]), RouteModule, MediaModule],
  providers: [EventRepository, CreateEventService, UpdateEventService, DeleteEventService, GetEventService],
  controllers: [EventController],
  exports: [EventRepository],
})
export class EventModule { }
