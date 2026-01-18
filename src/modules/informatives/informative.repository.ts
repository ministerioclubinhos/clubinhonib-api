import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { InformativeEntity } from './entities/informative.entity';

@Injectable()
export class InformativeRepository extends Repository<InformativeEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(InformativeEntity, dataSource.getRepository(InformativeEntity).manager);
  }

  async findPublic(): Promise<InformativeEntity[]> {
    return this.find({
      where: { public: true },
      order: { createdAt: 'DESC' },
    });
  }

  async findAllSorted(): Promise<InformativeEntity[]> {
    return this.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOneWithRelations(id: string): Promise<InformativeEntity | null> {
    return this.findOne({
      where: { id },
      relations: ['route'],
    });
  }

  async findOneById(id: string): Promise<InformativeEntity | null> {
    return this.findOne({ where: { id },
        relations: ['route'], });
  }
}
