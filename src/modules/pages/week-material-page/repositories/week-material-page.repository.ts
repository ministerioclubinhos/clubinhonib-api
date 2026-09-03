import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import {
  WEEK_MATERIALS_DEFAULT_LIMIT,
  WEEK_MATERIALS_DEFAULT_PAGE,
  WEEK_MATERIAL_DEFAULT_ORDER,
  WEEK_MATERIAL_DEFAULT_SORT,
  WEEK_MATERIAL_PAGE_RELATIONS,
  WEEK_MATERIAL_SORT_COLUMNS,
} from '../constants';
import { QueryWeekMaterialsDto } from '../dto/query-week-materials.dto';
import { WeekMaterialPageContent } from '../types';

@Injectable()
export class WeekMaterialsPageRepository {
  constructor(
    @InjectRepository(WeekMaterialsPageEntity)
    private readonly pageRepo: Repository<WeekMaterialsPageEntity>,
  ) {}

  private scoped(manager?: EntityManager): Repository<WeekMaterialsPageEntity> {
    return manager
      ? manager.getRepository(WeekMaterialsPageEntity)
      : this.pageRepo;
  }

  /** Busca e recorte da semana atual, resolvidos no banco. */
  private applyFilters(
    qb: SelectQueryBuilder<WeekMaterialsPageEntity>,
    query: QueryWeekMaterialsDto,
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

    if (query.currentWeek !== undefined) {
      qb.andWhere('page.currentWeek = :currentWeek', {
        currentWeek: query.currentWeek,
      });
    }
  }

  async findAllPaginated(
    query: QueryWeekMaterialsDto,
  ): Promise<{ items: WeekMaterialsPageEntity[]; total: number }> {
    const {
      page = WEEK_MATERIALS_DEFAULT_PAGE,
      limit = WEEK_MATERIALS_DEFAULT_LIMIT,
      sort = WEEK_MATERIAL_DEFAULT_SORT,
      order = WEEK_MATERIAL_DEFAULT_ORDER,
    } = query;

    const qb = this.pageRepo
      .createQueryBuilder('page')
      .leftJoinAndSelect('page.route', 'route');

    this.applyFilters(qb, query);

    qb.orderBy(WEEK_MATERIAL_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findOnePageById(
    id: string,
    manager?: EntityManager,
  ): Promise<WeekMaterialsPageEntity | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...WEEK_MATERIAL_PAGE_RELATIONS],
    });
  }

  async findCurrentWeek(
    manager?: EntityManager,
  ): Promise<WeekMaterialsPageEntity | null> {
    return this.scoped(manager).findOne({
      where: { currentWeek: true },
      relations: [...WEEK_MATERIAL_PAGE_RELATIONS],
    });
  }

  async createPage(
    content: Pick<
      WeekMaterialPageContent,
      'title' | 'subtitle' | 'description'
    > &
      Partial<Pick<WeekMaterialPageContent, 'currentWeek'>>,
    manager?: EntityManager,
  ): Promise<WeekMaterialsPageEntity> {
    const repository = this.scoped(manager);
    const page = repository.create(content);
    return repository.save(page);
  }

  async savePage(
    page: WeekMaterialsPageEntity,
    manager?: EntityManager,
  ): Promise<WeekMaterialsPageEntity> {
    return this.scoped(manager).save(page);
  }

  async removePage(
    page: WeekMaterialsPageEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).remove(page);
  }
}
