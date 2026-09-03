import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository, SelectQueryBuilder } from 'typeorm';

import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';

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
    @InjectRepository(IdeasSectionEntity)
    private readonly repo: Repository<IdeasSectionEntity>,
  ) {}

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
