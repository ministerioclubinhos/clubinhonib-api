import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { SiteFeedbackEntity } from '../entities/site-feedback.entity';
import { QueryFeedbacksDto } from '../dto/query-feedbacks.dto';
import {
  FEEDBACKS_DEFAULT_LIMIT,
  FEEDBACKS_DEFAULT_PAGE,
  FEEDBACK_DEFAULT_ORDER,
  FEEDBACK_DEFAULT_SORT,
  FEEDBACK_SORT_COLUMNS,
} from '../constants';

@Injectable()
export class SiteFeedbacksRepository {
  constructor(
    @InjectRepository(SiteFeedbackEntity)
    private readonly repo: Repository<SiteFeedbackEntity>,
  ) {}

  private baseQB(): SelectQueryBuilder<SiteFeedbackEntity> {
    return this.repo.createQueryBuilder('feedback');
  }

  /**
   * Aplica busca, categoria, nota e situação de leitura.
   *
   * Os filtros são feitos no banco, e não na tela: a listagem inteira chegava
   * ao navegador só para ser filtrada lá.
   */
  private applyFilters(
    qb: SelectQueryBuilder<SiteFeedbackEntity>,
    query: QueryFeedbacksDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(feedback.name) LIKE LOWER(:search) OR
          LOWER(feedback.email) LIKE LOWER(:search) OR
          LOWER(feedback.comment) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.category) {
      qb.andWhere('feedback.category = :category', {
        category: query.category,
      });
    }

    if (query.read !== undefined) {
      qb.andWhere('feedback.read = :read', { read: query.read });
    }

    if (query.rating != null) {
      qb.andWhere('feedback.rating = :rating', { rating: query.rating });
    }
  }

  async findAllPaginated(
    query: QueryFeedbacksDto,
  ): Promise<{ items: SiteFeedbackEntity[]; total: number }> {
    const {
      page = FEEDBACKS_DEFAULT_PAGE,
      limit = FEEDBACKS_DEFAULT_LIMIT,
      sort = FEEDBACK_DEFAULT_SORT,
      order = FEEDBACK_DEFAULT_ORDER,
    } = query;

    const qb = this.baseQB();
    this.applyFilters(qb, query);

    qb.orderBy(FEEDBACK_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /** Quantas avaliações ainda não foram lidas. */
  async countUnread(): Promise<number> {
    return this.repo.count({ where: { read: false } });
  }

  async findById(id: string): Promise<SiteFeedbackEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async createOne(
    data: Partial<SiteFeedbackEntity>,
  ): Promise<SiteFeedbackEntity> {
    return this.repo.save(this.repo.create(data));
  }

  async save(feedback: SiteFeedbackEntity): Promise<SiteFeedbackEntity> {
    return this.repo.save(feedback);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
