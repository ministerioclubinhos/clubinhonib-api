import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { MeditationEntity } from './entities/meditation.entity';

@Injectable()
export class MeditationRepository extends Repository<MeditationEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(MeditationEntity, dataSource.createEntityManager());
  }

  async findOneWithRelations(id: string): Promise<MeditationEntity | null> {
    return this.findOne({
      where: { id },
      relations: ['days'],
    });
  }

  async findAllWithRelations(): Promise<MeditationEntity[]> {
    return this.find({
      relations: ['days'],
      order: { startDate: 'ASC' },
    });
  }
}
