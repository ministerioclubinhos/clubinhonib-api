import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { IdeasPageEntity } from '../entities/ideas-page.entity';

@Injectable()
export class IdeasPageRepository extends Repository<IdeasPageEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(IdeasPageEntity, dataSource.createEntityManager());
  }

  /* Retorna todas as páginas com rota */
  async findAllPages(): Promise<IdeasPageEntity[]> {
    return this.find({ relations: ['route'] });
  }

  /* Busca única página por ID */
  async findOnePageById(id: string): Promise<IdeasPageEntity | null> {
    return this.findOne({ where: { id }, relations: ['route', 'sections'] });
  }

  /* Salva ou atualiza (TypeORM já faz merge) */
  async savePage(page: IdeasPageEntity): Promise<IdeasPageEntity> {
    return this.save(page);
  }

  async removePage(page: IdeasPageEntity): Promise<IdeasPageEntity> {
    return this.remove(page);
  }

  async upsertPage(
    id: string | undefined,
    pageData: Partial<IdeasPageEntity>,
  ): Promise<IdeasPageEntity> {
    if (id) {
      const existing = await this.findOnePageById(id);
      if (existing) {
        Object.assign(existing, pageData);
        return this.save(existing);
      }
    }
    const created = this.create(pageData);
    return this.save(created);
  }

  async removePageWithManager(
    manager: EntityManager,
    page: IdeasPageEntity,
  ): Promise<IdeasPageEntity> {
    return manager.remove(page);
  }

  async findAllPagesWithSections(): Promise<IdeasPageEntity[]> {
    return this.find({ relations: ['route', 'sections'] });
  }
}
