import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository, IsNull } from 'typeorm';
import { IdeasSectionEntity } from '../../ideas-page/entities/ideas-section.entity';

@Injectable()
export class IdeasSectionRepository extends Repository<IdeasSectionEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(IdeasSectionEntity, dataSource.createEntityManager());
  }

  async findByPageId(pageId: string): Promise<IdeasSectionEntity[]> {
    return this.find({
      where: { page: { id: pageId } },
      relations: ['page'],
    });
  }

  async findAllOrphanSections(): Promise<IdeasSectionEntity[]> {
    return this.find({
      where: { page: IsNull() },
    });
  }

  async upsertSection(sectionData: Partial<IdeasSectionEntity>): Promise<IdeasSectionEntity> {
    if (sectionData.id) {
      const existing = await this.findOne({ where: { id: sectionData.id } });

      if (!existing) {
        throw new NotFoundException(`Seção de ideias com ID=${sectionData.id} não encontrada.`);
      }

      const merged = this.merge(existing, sectionData);
      return this.save(merged);
    }

    const created = this.create(sectionData);
    return this.save(created);
  }

  async findAllOrfaSections(): Promise<IdeasSectionEntity[]> {
    return this.find({
      where: { page: IsNull() },
    });
  }
}
