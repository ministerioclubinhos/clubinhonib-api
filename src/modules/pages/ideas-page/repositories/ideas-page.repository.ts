import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { IdeasPageEntity } from '../entities/ideas-page.entity';
import { IdeasSectionEntity } from '../entities/ideas-section.entity';
import {
  IDEAS_PAGES_DEFAULT_LIMIT,
  IDEAS_PAGES_DEFAULT_PAGE,
  IDEAS_PAGE_DEFAULT_ORDER,
  IDEAS_PAGE_DEFAULT_SORT,
  IDEAS_PAGE_RELATIONS,
  IDEAS_PAGE_SORT_COLUMNS,
} from '../constants';
import { QueryIdeasPagesDto } from '../dto/query-ideas-pages.dto';
import { IdeasPageContent, IdeasSectionContent } from '../types';

@Injectable()
export class IdeasPageRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(IdeasPageEntity)
    private readonly pageRepo: Repository<IdeasPageEntity>,
    @InjectRepository(IdeasSectionEntity)
    private readonly sectionRepo: Repository<IdeasSectionEntity>,
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

  private scoped(manager?: EntityManager): Repository<IdeasPageEntity> {
    return manager ? manager.getRepository(IdeasPageEntity) : this.pageRepo;
  }

  private scopedSections(
    manager?: EntityManager,
  ): Repository<IdeasSectionEntity> {
    return manager
      ? manager.getRepository(IdeasSectionEntity)
      : this.sectionRepo;
  }

  /** Busca e visibilidade resolvidas no banco. */
  private applyFilters(
    qb: SelectQueryBuilder<IdeasPageEntity>,
    query: QueryIdeasPagesDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(page.title) LIKE LOWER(:search) OR
          LOWER(page.subtitle) LIKE LOWER(:search) OR
          LOWER(page.description) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.public !== undefined) {
      qb.andWhere('page.public = :public', { public: query.public });
    }
  }

  /**
   * Página da listagem, com a contagem de seções.
   *
   * As seções em si não são carregadas: a listagem do painel mostra apenas o
   * resumo, e trazer o conteúdo inteiro de cada página é o que tornava a tela
   * lenta à medida que o acervo crescia.
   */
  async findAllPaginated(
    query: QueryIdeasPagesDto,
  ): Promise<{ items: IdeasPageEntity[]; total: number }> {
    const {
      page = IDEAS_PAGES_DEFAULT_PAGE,
      limit = IDEAS_PAGES_DEFAULT_LIMIT,
      sort = IDEAS_PAGE_DEFAULT_SORT,
      order = IDEAS_PAGE_DEFAULT_ORDER,
    } = query;

    const qb = this.pageRepo
      .createQueryBuilder('page')
      .leftJoinAndSelect('page.route', 'route')
      .loadRelationCountAndMap('page.sectionCount', 'page.sections');

    this.applyFilters(qb, query);

    qb.orderBy(IDEAS_PAGE_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findByIdWithSections(
    id: string,
    manager?: EntityManager,
  ): Promise<IdeasPageEntity | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...IDEAS_PAGE_RELATIONS],
    });
  }

  async createPage(
    content: IdeasPageContent,
    manager?: EntityManager,
  ): Promise<IdeasPageEntity> {
    const repository = this.scoped(manager);
    return repository.save(repository.create(content));
  }

  async savePage(
    page: IdeasPageEntity,
    manager?: EntityManager,
  ): Promise<IdeasPageEntity> {
    return this.scoped(manager).save(page);
  }

  /**
   * Grava apenas as colunas da página. Evita `save()` no caminho de edição, que
   * arrastaria em cascata as seções carregadas com a entidade.
   */
  async updateContent(
    id: string,
    content: IdeasPageContent,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).update(id, content);
  }

  async removePage(
    page: IdeasPageEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).remove(page);
  }

  // --- seções -------------------------------------------------------------

  async findSectionsOfPage(
    pageId: string,
    manager?: EntityManager,
  ): Promise<IdeasSectionEntity[]> {
    return this.scopedSections(manager).find({
      where: { page: { id: pageId } },
    });
  }

  async createSection(
    page: IdeasPageEntity,
    section: IdeasSectionContent,
    manager?: EntityManager,
  ): Promise<IdeasSectionEntity> {
    const repository = this.scopedSections(manager);
    return repository.save(repository.create({ ...section, page }));
  }

  async saveSection(
    section: IdeasSectionEntity,
    manager?: EntityManager,
  ): Promise<IdeasSectionEntity> {
    return this.scopedSections(manager).save(section);
  }

  async removeSectionsByIds(
    ids: string[],
    manager?: EntityManager,
  ): Promise<void> {
    if (ids.length === 0) return;
    const repository = this.scopedSections(manager);
    const sections = await repository.find({ where: { id: In(ids) } });
    if (sections.length > 0) await repository.remove(sections);
  }
}
