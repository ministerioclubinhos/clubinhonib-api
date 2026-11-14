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
import { IdeasSectionAiEnhancementEntity } from '../../ideas-section-ai/entities/ideas-section-ai-enhancement.entity';
import {
  IdeaAiEnhancementStatus,
  IdeaAiQueueFilter,
} from '../../ideas-section-ai/enums/ideas-section-ai.enums';
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

    // Pendente é a que ainda não entrou em página nenhuma. O filtro usa o
    // alias da página juntada: a coluna da FK se chama `pageId`, e
    // `section.page_id` derrubava a fila inteira com erro interno.
    const qb = this.baseQB().where('page.id IS NULL');

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

    if (query.aiStatus) this.applyAiFilter(qb, query.aiStatus);

    qb.orderBy(IDEAS_SECTION_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /**
   * Recorte da fila pelo estado da IA, em subconsultas sobre as tentativas:
   * a página continua sendo resolvida no banco.
   */
  private applyAiFilter(
    qb: SelectQueryBuilder<IdeasSectionEntity>,
    filter: IdeaAiQueueFilter,
  ): void {
    const attempts = (alias: string, where: string) =>
      qb
        .subQuery()
        .select('1')
        .from(IdeasSectionAiEnhancementEntity, alias)
        .where(where)
        .getQuery();
    const active = attempts('active', 'active.activeSectionId = section.id');
    if (filter === IdeaAiQueueFilter.NONE) {
      qb.andWhere(
        `NOT EXISTS ${attempts('any', 'any.sectionId = section.id')}`,
      );
      return;
    }
    if (filter === IdeaAiQueueFilter.PROCESSING) {
      qb.andWhere(`EXISTS ${active}`);
      return;
    }
    if (filter === IdeaAiQueueFilter.READY) {
      qb.andWhere(
        `EXISTS ${attempts('result', 'result.currentResultSectionId = section.id')}`,
      ).andWhere(`NOT EXISTS ${active}`);
      return;
    }
    const latest = qb
      .subQuery()
      .select('MAX(latest.attempt)')
      .from(IdeasSectionAiEnhancementEntity, 'latest')
      .where('latest.sectionId = section.id')
      .getQuery();
    qb.andWhere(
      `EXISTS ${attempts(
        'failed',
        `failed.sectionId = section.id AND failed.status = :aiFailed AND failed.attempt = ${latest}`,
      )}`,
      { aiFailed: IdeaAiEnhancementStatus.FAILED },
    );
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
