import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { CommentEntity } from '../entities/comment.entity';
import { QueryCommentsDto } from '../dto/query-comments.dto';
import {
  COMMENTS_DEFAULT_LIMIT,
  COMMENTS_DEFAULT_PAGE,
  COMMENTS_PUBLISHED_LIMIT,
  COMMENT_DEFAULT_ORDER,
  COMMENT_DEFAULT_SORT,
  COMMENT_SORT_COLUMNS,
} from '../constants';

@Injectable()
export class CommentsRepository {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly repo: Repository<CommentEntity>,
  ) {}

  private baseQB(): SelectQueryBuilder<CommentEntity> {
    return this.repo.createQueryBuilder('comment');
  }

  /**
   * Aplica busca e situação de publicação.
   *
   * A busca é feita no banco, e não na tela: a listagem inteira chegava ao
   * navegador só para ser filtrada lá.
   */
  private applyFilters(
    qb: SelectQueryBuilder<CommentEntity>,
    query: QueryCommentsDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(comment.name) LIKE LOWER(:search) OR
          LOWER(comment.clubinho) LIKE LOWER(:search) OR
          LOWER(comment.neighborhood) LIKE LOWER(:search) OR
          LOWER(comment.comment) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.published !== undefined) {
      qb.andWhere('comment.published = :published', {
        published: query.published,
      });
    }
  }

  async findAllPaginated(
    query: QueryCommentsDto,
  ): Promise<{ items: CommentEntity[]; total: number }> {
    const {
      page = COMMENTS_DEFAULT_PAGE,
      limit = COMMENTS_DEFAULT_LIMIT,
      sort = COMMENT_DEFAULT_SORT,
      order = COMMENT_DEFAULT_ORDER,
    } = query;

    const qb = this.baseQB();
    this.applyFilters(qb, query);

    qb.orderBy(COMMENT_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /** Comentários publicados, para a página inicial. */
  async findPublished(): Promise<CommentEntity[]> {
    return this.repo.find({
      where: { published: true },
      order: { createdAt: 'DESC' },
      take: COMMENTS_PUBLISHED_LIMIT,
    });
  }

  /** Quantos comentários aguardam publicação. */
  async countUnpublished(): Promise<number> {
    return this.repo.count({ where: { published: false } });
  }

  async findById(id: string): Promise<CommentEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async createOne(data: Partial<CommentEntity>): Promise<CommentEntity> {
    return this.repo.save(this.repo.create(data));
  }

  async save(comment: CommentEntity): Promise<CommentEntity> {
    return this.repo.save(comment);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
