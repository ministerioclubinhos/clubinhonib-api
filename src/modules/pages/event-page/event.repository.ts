import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { EventEntity } from './entities/event.entity';

@Injectable()
export class EventRepository extends Repository<EventEntity> {
  constructor(private dataSource: DataSource) {
    super(EventEntity, dataSource.createEntityManager());
  }

  async findAll(): Promise<EventEntity[]> {
    return this.find({ order: { date: 'ASC' } });
  }

  async findById(id: string): Promise<EventEntity | null> {
    return this.findOne({ where: { id } });
  }

  async createAndSave(data: Partial<EventEntity>): Promise<EventEntity> {
    const newEvent = this.create(data);
    return this.save(newEvent);
  }

  async updateAndSave(id: string, data: Partial<EventEntity>): Promise<EventEntity> {
    await this.update(id, data);
    const updated = await this.findOneBy({ id });
    if (!updated) throw new Error('Evento não encontrado ao atualizar');
    return updated;
  }
  

  async deleteById(id: string): Promise<void> {
    await this.delete(id);
  }
}
