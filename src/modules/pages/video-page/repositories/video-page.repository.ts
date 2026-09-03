import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';
import { VideosPage } from '../entities/video-page.entity';
import {
  VIDEO_PAGES_DEFAULT_LIMIT,
  VIDEO_PAGES_DEFAULT_PAGE,
  VIDEO_PAGE_DEFAULT_ORDER,
  VIDEO_PAGE_DEFAULT_SORT,
  VIDEO_PAGE_RELATIONS,
  VIDEO_PAGE_SORT_COLUMNS,
} from '../constants';
import { QueryVideoPagesDto } from '../dto/query-video-pages.dto';
import { VideoPageContent } from '../types';

@Injectable()
export class VideosPageRepository {
  constructor(
    @InjectRepository(VideosPage)
    private readonly pageRepo: Repository<VideosPage>,
  ) {}

  private scoped(manager?: EntityManager): Repository<VideosPage> {
    return manager ? manager.getRepository(VideosPage) : this.pageRepo;
  }

  /** Busca e visibilidade resolvidas no banco. */
  private applyFilters(
    qb: SelectQueryBuilder<VideosPage>,
    query: QueryVideoPagesDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(page.name) LIKE LOWER(:search) OR
          LOWER(page.description) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    if (query.public !== undefined) {
      qb.andWhere('page.public = :public', { public: query.public });
    }
  }

  async findAllPaginated(
    query: QueryVideoPagesDto,
  ): Promise<{ items: VideosPage[]; total: number }> {
    const {
      page = VIDEO_PAGES_DEFAULT_PAGE,
      limit = VIDEO_PAGES_DEFAULT_LIMIT,
      sort = VIDEO_PAGE_DEFAULT_SORT,
      order = VIDEO_PAGE_DEFAULT_ORDER,
    } = query;

    const qb = this.pageRepo
      .createQueryBuilder('page')
      .leftJoinAndSelect('page.route', 'route');

    this.applyFilters(qb, query);

    qb.orderBy(VIDEO_PAGE_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<VideosPage | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...VIDEO_PAGE_RELATIONS],
    });
  }

  async createPage(
    content: VideoPageContent,
    manager?: EntityManager,
  ): Promise<VideosPage> {
    const repository = this.scoped(manager);
    return repository.save(repository.create(content));
  }

  async savePage(
    page: VideosPage,
    manager?: EntityManager,
  ): Promise<VideosPage> {
    return this.scoped(manager).save(page);
  }

  async removePage(page: VideosPage, manager?: EntityManager): Promise<void> {
    await this.scoped(manager).remove(page);
  }
}
