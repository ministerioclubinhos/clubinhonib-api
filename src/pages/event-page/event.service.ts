import { Injectable, NotFoundException } from '@nestjs/common';
import { EventRepository } from './event.repository';
import { EventEntity } from './entities/event.entity';

@Injectable()
export class EventService {
  constructor(private readonly eventRepo: EventRepository) {}

  async findAll(): Promise<EventEntity[]> {
    return this.eventRepo.findAll();
  }

  async findOne(id: string): Promise<EventEntity> {
    const event = await this.eventRepo.findById(id);
    if (!event) throw new NotFoundException('Evento não encontrado');
    return event;
  }

  async create(data: Partial<EventEntity>): Promise<EventEntity> {
    return this.eventRepo.createAndSave(data);
  }

  async update(id: string, data: Partial<EventEntity>): Promise<EventEntity> {
    const updated = await this.eventRepo.updateAndSave(id, data);
    if (!updated) throw new NotFoundException('Evento não encontrado');
    return updated;
  }

  async remove(id: string): Promise<void> {
    return this.eventRepo.deleteById(id);
  }
}
