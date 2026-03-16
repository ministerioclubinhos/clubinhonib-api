import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DocumentEntity } from 'src/modules/documents/entities/document.entity';

@Injectable()
export class DocumentRepository extends Repository<DocumentEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(DocumentEntity, dataSource.createEntityManager());
  }

  async findAllSorted(search?: string): Promise<DocumentEntity[]> {
    const qb = this.createQueryBuilder('doc').orderBy('doc.createdAt', 'DESC');

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere('(doc.name LIKE :term OR doc.description LIKE :term)', {
        term,
      });
    }

    return qb.getMany();
  }

  async findOneById(id: string): Promise<DocumentEntity | null> {
    return this.findOne({
      where: { id },
    });
  }

  async findOneWithRelations(id: string): Promise<DocumentEntity | null> {
    return this.findOne({
      where: { id },
      relations: ['route'],
    });
  }

  async upsertOne(data: Partial<DocumentEntity>): Promise<DocumentEntity> {
    const entity = this.create(data);
    return this.save(entity);
  }
}
