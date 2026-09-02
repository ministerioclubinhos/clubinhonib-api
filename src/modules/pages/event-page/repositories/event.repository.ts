import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { EventEntity } from '../entities/event.entity';
import { EventContent } from '../types';

@Injectable()
export class EventRepository {
  constructor(
    @InjectRepository(EventEntity)
    private readonly repo: Repository<EventEntity>,
  ) {}

  private scoped(manager?: EntityManager): Repository<EventEntity> {
    return manager ? manager.getRepository(EventEntity) : this.repo;
  }

  /**
   * Eventos da agenda. `includePrivate` decide se os encontros de clubinho
   * entram: quem sabe disso é o caso de uso, não o repositório.
   */
  async findAll(
    includePrivate: boolean,
    manager?: EntityManager,
  ): Promise<EventEntity[]> {
    const where: FindOptionsWhere<EventEntity> = includePrivate
      ? {}
      : { public: true };

    return this.scoped(manager).find({ where, order: { date: 'ASC' } });
  }

  /** Encontro semanal já criado para o clubinho, se existir. */
  async findByClubId(
    clubId: string,
    manager?: EntityManager,
  ): Promise<EventEntity | null> {
    return this.scoped(manager).findOne({ where: { clubId } });
  }

  async removeByClubId(clubId: string, manager?: EntityManager): Promise<void> {
    await this.scoped(manager).delete({ clubId });
  }

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<EventEntity | null> {
    return this.scoped(manager).findOne({ where: { id } });
  }

  async createEvent(
    content: EventContent,
    manager?: EntityManager,
  ): Promise<EventEntity> {
    const repository = this.scoped(manager);
    return repository.save(repository.create(content));
  }

  async saveEvent(
    event: EventEntity,
    manager?: EntityManager,
  ): Promise<EventEntity> {
    return this.scoped(manager).save(event);
  }

  async removeById(id: string, manager?: EntityManager): Promise<void> {
    await this.scoped(manager).delete(id);
  }
}
