import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  IsNull,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeasPageEntity } from 'src/modules/pages/ideas-page/entities/ideas-page.entity';

import { QueryIdeasSectionsDto } from '../dto/query-ideas-sections.dto';
import {
  IDEAS_SECTIONS_DEFAULT_LIMIT,
  IDEAS_SECTIONS_DEFAULT_PAGE,
  IDEAS_SECTION_DEFAULT_ORDER,
  IDEAS_SECTION_DEFAULT_SORT,
  IDEAS_SECTION_SORT_COLUMNS,
} from '../constants';

@Injectable()
export class IdeasSectionsRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(IdeasSectionEntity)
    private readonly repo: Repository<IdeasSectionEntity>,
  ) {}

  /**
   * Roda um conjunto de escritas numa transação só.
   *
   * Abrir e fechar transação é acesso ao banco, e mora aqui. O caso de uso
   * continua decidindo o que é atômico, mas não conhece `QueryRunner`, commit
   * nem rollback.
   */
  async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  /** Cria a seção dentro da transação em curso. */
  async createInTransaction(
    manager: EntityManager,
    data: { title: string; description: string; public: boolean },
  ): Promise<IdeasSectionEntity> {
    const repo = manager.getRepository(IdeasSectionEntity);

    return repo.save(repo.create({ ...data, page: undefined }));
  }

  /**
   * Grava a seção dentro da transação em curso.
   *
   * O `id` faz parte dos dados: sem ele o `save` insere uma linha nova e deixa
   * a original intacta.
   */
  async saveInTransaction(
    manager: EntityManager,
    data: Partial<IdeasSectionEntity>,
  ): Promise<IdeasSectionEntity> {
    return manager.save(IdeasSectionEntity, data as IdeasSectionEntity);
  }

  /** A seção com a página vinculada, lida dentro da transação em curso. */
  async findByIdInTransaction(
    manager: EntityManager,
    id: string,
  ): Promise<IdeasSectionEntity | null> {
    return manager.findOne(IdeasSectionEntity, {
      where: { id },
      relations: { page: true },
    });
  }

  /** Apaga a seção dentro da transação em curso. */
  async deleteByIdInTransaction(
    manager: EntityManager,
    id: string,
  ): Promise<void> {
    await manager.delete(IdeasSectionEntity, { id });
  }

  /**
   * A página de ideias em que a seção será publicada.
   *
   * A entidade é registrada neste módulo; a leitura fica no repositório para o
   * caso de uso não abrir a tabela por conta própria.
   */
  async findPageById(
    manager: EntityManager,
    pageId: string,
  ): Promise<IdeasPageEntity | null> {
    return manager.findOne(IdeasPageEntity, { where: { id: pageId } });
  }

  private baseQB(): SelectQueryBuilder<IdeasSectionEntity> {
    return this.repo
      .createQueryBuilder('section')
      .leftJoinAndSelect('section.page', 'page');
  }

  /**
   * Ideias ainda não publicadas, que é o que a fila da administração mostra.
   *
   * A busca é feita no banco, e não na tela: a lista inteira chegava ao
   * navegador só para ser filtrada lá.
   */
  async findPendingPaginated(
    query: QueryIdeasSectionsDto,
  ): Promise<{ items: IdeasSectionEntity[]; total: number }> {
    const {
      page = IDEAS_SECTIONS_DEFAULT_PAGE,
      limit = IDEAS_SECTIONS_DEFAULT_LIMIT,
      sort = IDEAS_SECTION_DEFAULT_SORT,
      order = IDEAS_SECTION_DEFAULT_ORDER,
    } = query;

    const qb = this.baseQB().where('section.page_id IS NULL');

    const search = query.searchString?.trim();
    if (search) {
      qb.andWhere(
        `(
          LOWER(section.title) LIKE LOWER(:search) OR
          LOWER(section.description) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    qb.orderBy(IDEAS_SECTION_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /** Quantas ideias aguardam decisão da administração. */
  async countPending(): Promise<number> {
    return this.repo.count({ where: { page: IsNull() } });
  }

  /** Carrega a seção com a página vinculada, quando existe. */
  async findById(id: string): Promise<IdeasSectionEntity | null> {
    return this.repo.findOne({ where: { id }, relations: { page: true } });
  }

  async findByPageId(pageId: string): Promise<IdeasSectionEntity[]> {
    return this.repo.find({
      where: { page: { id: pageId } },
      relations: { page: true },
    });
  }
}
