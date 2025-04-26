import { Injectable } from '@nestjs/common';
import { DocumentEntity } from 'src/documents/entities/document.entity';
import { DataSource, Repository } from 'typeorm';

@Injectable()
export class DocumentRepository extends Repository<DocumentEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(DocumentEntity, dataSource.createEntityManager());
  }

  async findAllSorted(): Promise<DocumentEntity[]> {
    return this.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOneById(id: string): Promise<DocumentEntity | null> {
    return this.findOne({ where: { id } });
  }

  async upsertOne(document: Partial<DocumentEntity>): Promise<DocumentEntity> {
    // Caso o documento tenha `id`, atualiza, senão cria novo
    const entity = this.create(document);
    const result = await this.save(entity);
    return result;
  }
}
