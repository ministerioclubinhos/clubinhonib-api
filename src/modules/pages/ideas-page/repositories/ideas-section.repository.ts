import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';



@Injectable()
export class IdeasSectionRepository extends Repository<IdeasSectionEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(IdeasSectionEntity, dataSource.createEntityManager());
  }

  async findByPageId(pageId: string): Promise<IdeasSectionEntity[]> {
    return this.find({ where: { page: { id: pageId } }, relations: ['page'] });
  }

  async upsertSection(section: Partial<IdeasSectionEntity>): Promise<IdeasSectionEntity> {
    if (section.id) {
      const existing = await this.findOne({ where: { id: section.id } });
      if (!existing) throw new NotFoundException(`Seção ID=${section.id} não encontrada.`);
      const merged = this.merge(existing, section);
      return this.save(merged);
    }
    const created = this.create(section);
    return this.save(created);
  }
}