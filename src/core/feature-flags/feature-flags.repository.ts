import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { FeatureFlagEntity } from './entities/feature-flag.entity';
import { QueryFeatureFlagsDto } from './dto/query-feature-flags.dto';
import {
  FEATURE_FLAGS_DEFAULT_LIMIT,
  FEATURE_FLAGS_DEFAULT_PAGE,
  FEATURE_FLAG_DEFAULT_ORDER,
  FEATURE_FLAG_DEFAULT_SORT,
  FEATURE_FLAG_SORT_COLUMNS,
} from './constants';

@Injectable()
export class FeatureFlagsRepository {
  constructor(
    @InjectRepository(FeatureFlagEntity)
    private readonly repo: Repository<FeatureFlagEntity>,
  ) {}

  /** Busca e situação resolvidas no banco. */
  private applyFilters(
    qb: SelectQueryBuilder<FeatureFlagEntity>,
    query: QueryFeatureFlagsDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(flag.key) LIKE LOWER(:search) OR
          LOWER(flag.name) LIKE LOWER(:search) OR
          LOWER(flag.description) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.enabled !== undefined) {
      qb.andWhere('flag.enabled = :enabled', { enabled: query.enabled });
    }
  }

  /**
   * Página da listagem administrativa.
   *
   * O recorte por combinação de perfis não entra aqui: `target_roles` é uma
   * coluna JSON que ainda guarda listas fora de ordem e com grafias antigas,
   * e comparar isso em SQL erraria. Quem filtra por audiência é o caso de uso,
   * sobre os perfis já normalizados.
   */
  async findAllPaginated(
    query: QueryFeatureFlagsDto,
  ): Promise<{ items: FeatureFlagEntity[]; total: number }> {
    const {
      page = FEATURE_FLAGS_DEFAULT_PAGE,
      limit = FEATURE_FLAGS_DEFAULT_LIMIT,
      sort = FEATURE_FLAG_DEFAULT_SORT,
      order = FEATURE_FLAG_DEFAULT_ORDER,
    } = query;

    const qb = this.repo.createQueryBuilder('flag');
    this.applyFilters(qb, query);

    qb.orderBy(FEATURE_FLAG_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /** Todas as flags que atendem aos filtros, sem paginar. */
  async findAllFiltered(
    query: QueryFeatureFlagsDto,
  ): Promise<FeatureFlagEntity[]> {
    const {
      sort = FEATURE_FLAG_DEFAULT_SORT,
      order = FEATURE_FLAG_DEFAULT_ORDER,
    } = query;

    const qb = this.repo.createQueryBuilder('flag');
    this.applyFilters(qb, query);
    qb.orderBy(FEATURE_FLAG_SORT_COLUMNS[sort], order);

    return qb.getMany();
  }

  async findAll(): Promise<FeatureFlagEntity[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findByKey(key: string): Promise<FeatureFlagEntity | null> {
    return this.repo.findOne({ where: { key } });
  }

  create(data: Partial<FeatureFlagEntity>): FeatureFlagEntity {
    return this.repo.create(data);
  }

  async save(flag: FeatureFlagEntity): Promise<FeatureFlagEntity> {
    return this.repo.save(flag);
  }

  async remove(flag: FeatureFlagEntity): Promise<void> {
    await this.repo.remove(flag);
  }
}
