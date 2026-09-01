import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
} from 'typeorm';
import { MeditationEntity } from '../entities/meditation.entity';
import { DayEntity } from '../entities/day.entity';
import { MEDITATION_RELATIONS } from '../constants';
import { MeditationContent } from '../types';

@Injectable()
export class MeditationRepository {
  constructor(
    @InjectRepository(MeditationEntity)
    private readonly meditationRepo: Repository<MeditationEntity>,
    @InjectRepository(DayEntity)
    private readonly dayRepo: Repository<DayEntity>,
  ) {}

  private scoped(manager?: EntityManager): Repository<MeditationEntity> {
    return manager
      ? manager.getRepository(MeditationEntity)
      : this.meditationRepo;
  }

  private scopedDays(manager?: EntityManager): Repository<DayEntity> {
    return manager ? manager.getRepository(DayEntity) : this.dayRepo;
  }

  async findAllWithDays(): Promise<MeditationEntity[]> {
    return this.meditationRepo.find({
      relations: [...MEDITATION_RELATIONS],
      order: { startDate: 'DESC' },
    });
  }

  async findOneWithDays(
    id: string,
    manager?: EntityManager,
  ): Promise<MeditationEntity | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...MEDITATION_RELATIONS],
    });
  }

  /**
   * Primeira meditação cujo período cruza o intervalo informado. Duas faixas se
   * sobrepõem quando uma começa antes do fim da outra e termina depois do
   * início dela — resolver isso no banco evita carregar a tabela inteira.
   */
  async findOverlapping(
    startDate: string,
    endDate: string,
    excludeId?: string,
    manager?: EntityManager,
  ): Promise<MeditationEntity | null> {
    return this.scoped(manager).findOne({
      where: {
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
      relations: [...MEDITATION_RELATIONS],
    });
  }

  /** Meditação cujo período contém a data informada. */
  async findByDate(date: string): Promise<MeditationEntity | null> {
    return this.meditationRepo.findOne({
      where: {
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
      relations: [...MEDITATION_RELATIONS],
    });
  }

  async createMeditation(
    content: MeditationContent,
    days: Pick<DayEntity, 'day' | 'verse' | 'topic'>[],
    manager?: EntityManager,
  ): Promise<MeditationEntity> {
    const repository = this.scoped(manager);
    const meditation = repository.create({ ...content, days });
    return repository.save(meditation);
  }

  async saveMeditation(
    meditation: MeditationEntity,
    manager?: EntityManager,
  ): Promise<MeditationEntity> {
    return this.scoped(manager).save(meditation);
  }

  async removeMeditation(
    meditation: MeditationEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).remove(meditation);
  }

  async removeDays(days: DayEntity[], manager?: EntityManager): Promise<void> {
    if (days.length === 0) return;
    await this.scopedDays(manager).remove(days);
  }

  async saveDays(
    meditation: MeditationEntity,
    days: Pick<DayEntity, 'day' | 'verse' | 'topic'>[],
    manager?: EntityManager,
  ): Promise<DayEntity[]> {
    const repository = this.scopedDays(manager);
    const entities = days.map((day) =>
      repository.create({ ...day, meditation }),
    );
    return repository.save(entities);
  }
}
