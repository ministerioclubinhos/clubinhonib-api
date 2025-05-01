import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DocumentEntity } from 'src/documents/entities/document.entity';

@Injectable()
export class DocumentRepository extends Repository<DocumentEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(DocumentEntity, dataSource.createEntityManager());
  }

  async findAllSorted(): Promise<DocumentEntity[]> {
    return this.find({
      order: {
        createdAt: 'DESC',
      },
    });
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
