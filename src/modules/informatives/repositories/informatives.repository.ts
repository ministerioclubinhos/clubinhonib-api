import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { InformativeEntity } from '../entities/informative.entity';
import { QueryInformativesDto } from '../dto/query-informatives.dto';
import {
  INFORMATIVES_DEFAULT_LIMIT,
  INFORMATIVES_DEFAULT_PAGE,
  INFORMATIVE_DEFAULT_ORDER,
  INFORMATIVE_DEFAULT_SORT,
  INFORMATIVE_SORT_COLUMNS,
} from '../constants';

@Injectable()
export class InformativesRepository {
  constructor(
    @InjectRepository(InformativeEntity)
    private readonly repo: Repository<InformativeEntity>,
  ) {}

  private baseQB(): SelectQueryBuilder<InformativeEntity> {
    return this.repo
      .createQueryBuilder('informative')
      .leftJoinAndSelect('informative.route', 'route');
  }

  /**
   * Aplica busca e visibilidade.
   *
   * Tudo é filtrado no banco: a listagem inteira chegava ao navegador só para
   * ser peneirada lá.
   */
  private applyFilters(
    qb: SelectQueryBuilder<InformativeEntity>,
    query: QueryInformativesDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(informative.title) LIKE LOWER(:search) OR
          LOWER(informative.description) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.public !== undefined) {
      qb.andWhere('informative.public = :public', { public: query.public });
    }
  }

  async findAllPaginated(
    query: QueryInformativesDto,
  ): Promise<{ items: InformativeEntity[]; total: number }> {
    const {
      page = INFORMATIVES_DEFAULT_PAGE,
      limit = INFORMATIVES_DEFAULT_LIMIT,
      sort = INFORMATIVE_DEFAULT_SORT,
      order = INFORMATIVE_DEFAULT_ORDER,
    } = query;

    const qb = this.baseQB();
    this.applyFilters(qb, query);

    qb.orderBy(INFORMATIVE_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findById(id: string): Promise<InformativeEntity | null> {
    return this.repo.findOne({ where: { id }, relations: { route: true } });
  }

  async remove(informative: InformativeEntity): Promise<void> {
    await this.repo.remove(informative);
  }
}
