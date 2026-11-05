import {
  MediaItemEntity,
  MediaType,
} from 'src/shared/media/media-item/media-item.entity';
import { FeedPhotoContextDto } from '../dto/feed-photo-context.dto';
import { IMAGE_PAGE_ENTITY_TYPE } from '../constants';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { ImagePageEntity } from '../entity/Image-page.entity';
import { ImageSectionEntity } from '../entity/Image-section.entity';
import {
  IMAGE_PAGES_DEFAULT_LIMIT,
  IMAGE_PAGES_DEFAULT_PAGE,
  IMAGE_PAGE_DEFAULT_ORDER,
  IMAGE_PAGE_DEFAULT_SORT,
  IMAGE_PAGE_RELATIONS,
  IMAGE_PAGE_SORT_COLUMNS,
} from '../constants';
import { QueryImagePagesDto } from '../dto/query-image-pages.dto';
import { ImagePageContent } from '../types';

@Injectable()
export class ImagePageRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ImagePageEntity)
    private readonly pageRepo: Repository<ImagePageEntity>,
    @InjectRepository(ImageSectionEntity)
    private readonly sectionRepo: Repository<ImageSectionEntity>,
  ) {}

  async findFeedPhotoContext(
    mediaId: string,
    pageId: string,
  ): Promise<FeedPhotoContextDto | null> {
    const photo = await this.sectionRepo
      .createQueryBuilder('section')
      .innerJoin('section.page', 'page')
      .innerJoin(
        MediaItemEntity,
        'media',
        'media.targetId = section.id AND media.targetType = :targetType',
        { targetType: IMAGE_PAGE_ENTITY_TYPE },
      )
      .select('media.id', 'mediaId')
      .addSelect('media.url', 'photoUrl')
      .addSelect('media.title', 'photoTitle')
      .addSelect('section.id', 'sectionId')
      .addSelect('section.caption', 'sectionCaption')
      .addSelect('section.public', 'sectionPublic')
      .addSelect('page.id', 'pageId')
      .addSelect('page.public', 'pagePublic')
      .where(
        'media.id = :mediaId AND media.mediaType = :mediaType AND page.id = :pageId',
        { mediaId, mediaType: MediaType.IMAGE, pageId },
      )
      .getRawOne<FeedPhotoContextDto>();
    return photo
      ? {
          ...photo,
          sectionPublic: Boolean(photo.sectionPublic),
          pagePublic: Boolean(photo.pagePublic),
        }
      : null;
  }

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

  private scoped(manager?: EntityManager): Repository<ImagePageEntity> {
    return manager ? manager.getRepository(ImagePageEntity) : this.pageRepo;
  }

  private scopedSections(
    manager?: EntityManager,
  ): Repository<ImageSectionEntity> {
    return manager
      ? manager.getRepository(ImageSectionEntity)
      : this.sectionRepo;
  }

  /** Busca e visibilidade resolvidas no banco. */
  private applyFilters(
    qb: SelectQueryBuilder<ImagePageEntity>,
    query: QueryImagePagesDto,
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

  /**
   * Página da listagem de galerias, com a contagem de seções.
   *
   * As seções em si não são carregadas: a listagem do painel mostra apenas o
   * resumo, e trazer o conteúdo inteiro de cada galeria é o que tornava a tela
   * lenta à medida que o acervo crescia.
   */
  async findAllPaginated(
    query: QueryImagePagesDto,
  ): Promise<{ items: ImagePageEntity[]; total: number }> {
    const {
      page = IMAGE_PAGES_DEFAULT_PAGE,
      limit = IMAGE_PAGES_DEFAULT_LIMIT,
      sort = IMAGE_PAGE_DEFAULT_SORT,
      order = IMAGE_PAGE_DEFAULT_ORDER,
    } = query;

    const qb = this.pageRepo
      .createQueryBuilder('page')
      .leftJoinAndSelect('page.route', 'route')
      .loadRelationCountAndMap('page.sectionCount', 'page.sections');

    this.applyFilters(qb, query);

    qb.orderBy(IMAGE_PAGE_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findByIdWithSections(
    id: string,
    manager?: EntityManager,
  ): Promise<ImagePageEntity | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...IMAGE_PAGE_RELATIONS],
    });
  }

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<ImagePageEntity | null> {
    return this.scoped(manager).findOne({ where: { id } });
  }

  async createPage(
    content: ImagePageContent,
    manager?: EntityManager,
  ): Promise<ImagePageEntity> {
    const repository = this.scoped(manager);
    return repository.save(repository.create(content));
  }

  async savePage(
    page: ImagePageEntity,
    manager?: EntityManager,
  ): Promise<ImagePageEntity> {
    return this.scoped(manager).save(page);
  }

  async removePage(
    page: ImagePageEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).remove(page);
  }

  // --- seções -------------------------------------------------------------

  async findSectionsOfPage(
    pageId: string,
    manager?: EntityManager,
  ): Promise<ImageSectionEntity[]> {
    return this.scopedSections(manager).find({
      where: { page: { id: pageId } },
    });
  }

  /**
   * Página de seções de uma galeria. `includePrivate` decide se as seções
   * privadas entram no resultado — quem sabe disso é o caso de uso, não o
   * repositório.
   */
  async findSectionsPaginated(
    pageId: string,
    offset: number,
    limit: number,
    includePrivate: boolean,
  ): Promise<[ImageSectionEntity[], number]> {
    const where: FindOptionsWhere<ImageSectionEntity> = {
      page: { id: pageId },
      ...(includePrivate ? {} : { public: true }),
    };

    return this.sectionRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: offset,
      take: limit,
    });
  }

  async createSection(
    page: ImagePageEntity,
    section: Pick<ImageSectionEntity, 'caption' | 'description' | 'public'>,
    manager?: EntityManager,
  ): Promise<ImageSectionEntity> {
    const repository = this.scopedSections(manager);
    return repository.save(repository.create({ ...section, page }));
  }

  async saveSection(
    section: ImageSectionEntity,
    manager?: EntityManager,
  ): Promise<ImageSectionEntity> {
    return this.scopedSections(manager).save(section);
  }

  async findSectionById(
    id: string,
    manager?: EntityManager,
  ): Promise<ImageSectionEntity | null> {
    return this.scopedSections(manager).findOne({ where: { id } });
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
