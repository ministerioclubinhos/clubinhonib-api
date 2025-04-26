import { Controller, Get, Post, Patch, Delete, Param, Body } from '@nestjs/common';
import { EventService } from './event.service';
import { EventEntity } from './entities/event.entity';

@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get()
  findAll(): Promise<EventEntity[]> {
    return this.eventService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<EventEntity> {
    return this.eventService.findOne(id);
  }

  @Post()
  create(@Body() data: Partial<EventEntity>): Promise<EventEntity> {
    return this.eventService.create(data);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() data: Partial<EventEntity>): Promise<EventEntity> {
    return this.eventService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.eventService.remove(id);
  }
}
