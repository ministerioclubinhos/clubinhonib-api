import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { ImageSectionEntity } from 'src/modules/pages/image-page/entity/Image-section.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

import { QueryImageSectionsDto } from '../dto/query-image-sections.dto';
import {
  IMAGE_SECTIONS_DEFAULT_LIMIT,
  IMAGE_SECTIONS_DEFAULT_PAGE,
  IMAGE_SECTION_DEFAULT_ORDER,
  IMAGE_SECTION_DEFAULT_SORT,
  IMAGE_SECTION_SORT_COLUMNS,
} from '../constants';

@Injectable()
export class ImageSectionsRepository {
  constructor(
    @InjectRepository(ImageSectionEntity)
    private readonly repo: Repository<ImageSectionEntity>,
  ) {}

  private baseQB(): SelectQueryBuilder<ImageSectionEntity> {
    return this.repo
      .createQueryBuilder('section')
      .leftJoinAndSelect('section.page', 'page');
  }

  /**
   * Aplica busca e situação de aprovação.
   *
   * Tudo é filtrado no banco: a listagem inteira chegava ao navegador só para
   * ser peneirada lá.
   */
  private applyFilters(
    qb: SelectQueryBuilder<ImageSectionEntity>,
    query: QueryImageSectionsDto,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      qb.andWhere(
        `(
          LOWER(section.caption) LIKE LOWER(:search) OR
          LOWER(section.description) LIKE LOWER(:search)
        )`,
        { search: `%${search}%` },
      );
    }

    // Aprovada é a que já entrou na página do feed.
    if (query.approved === true) {
      qb.andWhere('section.page_id IS NOT NULL');
    } else if (query.approved === false) {
      qb.andWhere('section.page_id IS NULL');
    }

    if (query.hasMedia !== undefined) {
      const existeMidia = qb
        .subQuery()
        .select('1')
        .from(MediaItemEntity, 'media')
        .where('media.targetId = section.id')
        .andWhere('media.targetType = :targetType')
        .getQuery();

      qb.andWhere(
        query.hasMedia ? `EXISTS ${existeMidia}` : `NOT EXISTS ${existeMidia}`,
        { targetType: MediaTargetType.ImagesPage },
      );
    }
  }

  async findAllPaginated(
    query: QueryImageSectionsDto,
  ): Promise<{ items: ImageSectionEntity[]; total: number }> {
    const {
      page = IMAGE_SECTIONS_DEFAULT_PAGE,
      limit = IMAGE_SECTIONS_DEFAULT_LIMIT,
      sort = IMAGE_SECTION_DEFAULT_SORT,
      order = IMAGE_SECTION_DEFAULT_ORDER,
    } = query;

    const qb = this.baseQB();
    this.applyFilters(qb, query);

    qb.orderBy(IMAGE_SECTION_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  /** Quantas fotos aguardam aprovação. */
  async countPending(): Promise<number> {
    return this.baseQB().where('section.page_id IS NULL').getCount();
  }

  /** Carrega a seção com a página vinculada, quando existe. */
  async findById(id: string): Promise<ImageSectionEntity | null> {
    return this.repo.findOne({ where: { id }, relations: { page: true } });
  }
}
