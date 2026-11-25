import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { VideosPage } from 'src/modules/pages/video-page/entities/video-page.entity';
import {
  MediaItemEntity,
  MediaType,
} from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { PlayVideoEntryEntity } from '../entities/play-video-entry.entity';
import { PlayCategoryEntity } from '../entities/play-category.entity';
import { PlayVideoProgressEntity } from '../entities/play-video-progress.entity';
import { PlayVideoViewEntity } from '../entities/play-video-view.entity';
import { PlayScope } from '../enums/play-scope.enum';
import { PlaySort } from '../enums/play-sort.enum';
import {
  PLAY_DEFAULT_LIMIT,
  PLAY_DEFAULT_PAGE,
  PLAY_POSITION_UNSET_SORT,
} from '../constants';
import { PlayEntryInput, PlayVideoFilters, PlayVideoRow } from '../types';

type MediaQuery = SelectQueryBuilder<MediaItemEntity>;

export interface GalleryCountRow {
  id: string;
  title: string;
  videoCount: number | string;
}

export interface CategoryCountRow {
  id: string;
  name: string;
  slug: string;
  position: number;
  videoCount: number | string;
}

export interface VideoStatRow {
  id: string;
  title: string;
  galleryTitle: string;
  views: number | string;
  viewers: number | string;
  completed: number | string;
  lastViewedAt: Date | string | null;
}

@Injectable()
export class PlayVideoEntryRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PlayVideoEntryEntity)
    private readonly entryRepo: Repository<PlayVideoEntryEntity>,
  ) {}

  private scoped(manager?: EntityManager): Repository<PlayVideoEntryEntity> {
    return manager
      ? manager.getRepository(PlayVideoEntryEntity)
      : this.entryRepo;
  }

  /** Troca todas as linhas da galeria pelas informadas (lista vazia = limpa). */
  async replaceForPage(
    videosPageId: string,
    inputs: PlayEntryInput[],
    manager?: EntityManager,
  ): Promise<PlayVideoEntryEntity[]> {
    const repo = this.scoped(manager);
    await repo.delete({ videosPageId });
    if (inputs.length === 0) return [];
    return repo.save(
      inputs.map((input) => repo.create({ videosPageId, ...input })),
    );
  }

  /** Acrescenta um vídeo ao Play de uma galeria sem mexer nos demais. */
  addEntry(
    videosPageId: string,
    input: PlayEntryInput,
    manager?: EntityManager,
  ): Promise<PlayVideoEntryEntity> {
    const repo = this.scoped(manager);
    return repo.save(repo.create({ videosPageId, ...input }));
  }

  /** Galerias que hoje enviam vídeos ao Play (escopo diferente de `none`). */
  findPlayGalleries(): Promise<{ id: string; title: string; scope: string }[]> {
    return this.dataSource
      .createQueryBuilder()
      .from(VideosPage, 'page')
      .select('page.id', 'id')
      .addSelect('page.name', 'title')
      .addSelect('page.playScope', 'scope')
      .where('page.playScope <> :none', { none: PlayScope.NONE })
      .orderBy('page.name', 'ASC')
      .getRawMany<{ id: string; title: string; scope: string }>();
  }

  findByPage(
    videosPageId: string,
    manager?: EntityManager,
  ): Promise<PlayVideoEntryEntity[]> {
    return this.scoped(manager).find({ where: { videosPageId } });
  }

  /**
   * Vídeos visíveis no Play: a única regra de visibilidade do sistema.
   * Visível = escopo `all`, ou `selected` com linha de entrada.
   */
  private visibleVideos(): MediaQuery {
    return this.dataSource
      .createQueryBuilder()
      .from(MediaItemEntity, 'media')
      .innerJoin(VideosPage, 'page', 'page.id = media.targetId')
      .leftJoin(PlayVideoEntryEntity, 'entry', 'entry.mediaItemId = media.id')
      .where('media.targetType = :targetType', {
        targetType: MediaTargetType.VideosPage,
      })
      .andWhere('media.mediaType = :mediaType', { mediaType: MediaType.VIDEO })
      .andWhere(
        '(page.playScope = :all OR (page.playScope = :selected AND entry.id IS NOT NULL))',
        { all: PlayScope.ALL, selected: PlayScope.SELECTED },
      ) as MediaQuery;
  }

  /** Visíveis + categoria, progresso e favorito de quem pergunta. */
  private forUser(userId: string): MediaQuery {
    return this.visibleVideos()
      .leftJoin(PlayCategoryEntity, 'cat', 'cat.id = page.playCategoryId')
      .leftJoin(
        PlayVideoProgressEntity,
        'prog',
        'prog.mediaItemId = media.id AND prog.userId = :userId',
        { userId },
      );
  }

  private applyFilters(qb: MediaQuery, filters: PlayVideoFilters): void {
    const search = filters.search?.trim();
    if (search) {
      qb.andWhere(
        `(LOWER(media.title) LIKE LOWER(:search) OR LOWER(media.description) LIKE LOWER(:search)
          OR LOWER(page.name) LIKE LOWER(:search) OR LOWER(cat.name) LIKE LOWER(:search))`,
        { search: `%${search}%` },
      );
    }
    if (filters.galleryId) {
      qb.andWhere('page.id = :galleryId', { galleryId: filters.galleryId });
    }
    if (filters.categoryId) {
      qb.andWhere('page.playCategoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }
    if (filters.featured) qb.andWhere('entry.featured = 1');
    if (filters.excludeId) {
      qb.andWhere('media.id <> :excludeId', { excludeId: filters.excludeId });
    }
    if (filters.favorites) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM play_favorites ff WHERE ff.media_item_id = media.id AND ff.user_id = :userId)',
      );
    }
    if (filters.inProgress) {
      qb.andWhere(
        'prog.id IS NOT NULL AND prog.completed = 0 AND prog.positionSeconds > 0',
      );
    }
  }

  private selectRow(qb: MediaQuery): MediaQuery {
    return qb
      .select('media.id', 'id')
      .addSelect('media.title', 'title')
      .addSelect('media.description', 'description')
      .addSelect('media.uploadType', 'uploadType')
      .addSelect('media.platformType', 'platformType')
      .addSelect('media.url', 'url')
      .addSelect('media.isLocalFile', 'isLocalFile')
      .addSelect('media.originalName', 'originalName')
      .addSelect('media.size', 'size')
      .addSelect('media.createdAt', 'createdAt')
      .addSelect('page.id', 'galleryId')
      .addSelect('page.name', 'galleryTitle')
      .addSelect('entry.featured', 'featured')
      .addSelect('entry.thumbnailUrl', 'thumbnailUrl')
      .addSelect('entry.durationSeconds', 'durationSeconds')
      .addSelect('cat.id', 'categoryId')
      .addSelect('cat.name', 'categoryName')
      .addSelect(
        '(SELECT COUNT(*) FROM play_video_views vv WHERE vv.media_item_id = media.id)',
        'viewCount',
      )
      .addSelect(
        '(SELECT COUNT(*) > 0 FROM play_favorites f2 WHERE f2.media_item_id = media.id AND f2.user_id = :userId)',
        'favorite',
      )
      .addSelect('prog.positionSeconds', 'progressPosition')
      .addSelect('prog.durationSeconds', 'progressDuration')
      .addSelect('prog.completed', 'progressCompleted');
  }

  private applyOrder(qb: MediaQuery, filters: PlayVideoFilters): void {
    if (filters.relatedToGalleryId) {
      qb.orderBy(
        `CASE WHEN page.id = :relGallery THEN 0 WHEN cat.id IS NOT NULL AND cat.id = :relCategory THEN 1 ELSE 2 END`,
        'ASC',
      ).setParameters({
        relGallery: filters.relatedToGalleryId,
        relCategory: filters.relatedToCategoryId ?? '',
      });
      qb.addOrderBy(
        `COALESCE(entry.position, ${PLAY_POSITION_UNSET_SORT})`,
        'ASC',
      );
      qb.addOrderBy('media.createdAt', 'ASC').addOrderBy('media.id', 'ASC');
      return;
    }

    switch (filters.sort ?? PlaySort.CURATED) {
      case PlaySort.RECENT:
        qb.orderBy('media.createdAt', 'DESC');
        break;
      case PlaySort.POPULAR:
        qb.orderBy('viewCount', 'DESC').addOrderBy('media.createdAt', 'DESC');
        break;
      case PlaySort.TITLE:
        qb.orderBy('media.title', 'ASC');
        break;
      case PlaySort.CONTINUE:
        qb.orderBy('prog.updatedAt', 'DESC');
        break;
      default:
        qb.orderBy('COALESCE(entry.featured, 0)', 'DESC')
          .addOrderBy(
            `COALESCE(entry.position, ${PLAY_POSITION_UNSET_SORT})`,
            'ASC',
          )
          .addOrderBy('media.createdAt', 'ASC');
    }
    qb.addOrderBy('media.id', 'ASC');
  }

  async findVideos(
    filters: PlayVideoFilters,
  ): Promise<{ rows: PlayVideoRow[]; total: number }> {
    const page = filters.page ?? PLAY_DEFAULT_PAGE;
    const limit = filters.limit ?? PLAY_DEFAULT_LIMIT;

    const countQb = this.forUser(filters.userId);
    this.applyFilters(countQb, filters);
    const total = await countQb.getCount();

    const qb = this.selectRow(this.forUser(filters.userId));
    this.applyFilters(qb, filters);
    this.applyOrder(qb, filters);
    const rows = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<PlayVideoRow>();

    return { rows, total };
  }

  findVideo(id: string, userId: string): Promise<PlayVideoRow | undefined> {
    return this.selectRow(this.forUser(userId))
      .andWhere('media.id = :id', { id })
      .getRawOne<PlayVideoRow>();
  }

  /** True quando o vídeo está visível no Play. */
  async isVisible(id: string): Promise<boolean> {
    return (
      (await this.visibleVideos()
        .andWhere('media.id = :id', { id })
        .getCount()) > 0
    );
  }

  /** Galerias com vídeos no Play, da mais cheia para a mais vazia. */
  findGalleries(limit: number): Promise<GalleryCountRow[]> {
    return this.visibleVideos()
      .select('page.id', 'id')
      .addSelect('page.name', 'title')
      .addSelect('COUNT(media.id)', 'videoCount')
      .groupBy('page.id')
      .addGroupBy('page.name')
      .orderBy('COUNT(media.id)', 'DESC')
      .addOrderBy('page.name', 'ASC')
      .limit(limit)
      .getRawMany<GalleryCountRow>();
  }

  /** Categorias com a contagem de vídeos hoje visíveis. */
  findCategoriesWithCount(): Promise<CategoryCountRow[]> {
    return this.dataSource
      .createQueryBuilder()
      .from(PlayCategoryEntity, 'cat')
      .leftJoin(VideosPage, 'page', 'page.playCategoryId = cat.id')
      .leftJoin(
        MediaItemEntity,
        'media',
        `media.targetId = page.id AND media.targetType = :targetType AND media.mediaType = :mediaType`,
        { targetType: MediaTargetType.VideosPage, mediaType: MediaType.VIDEO },
      )
      .leftJoin(PlayVideoEntryEntity, 'entry', 'entry.mediaItemId = media.id')
      .select('cat.id', 'id')
      .addSelect('cat.name', 'name')
      .addSelect('cat.slug', 'slug')
      .addSelect('cat.position', 'position')
      .addSelect(
        `COUNT(DISTINCT CASE WHEN page.playScope = :all OR (page.playScope = :selected AND entry.id IS NOT NULL) THEN media.id END)`,
        'videoCount',
      )
      .setParameters({ all: PlayScope.ALL, selected: PlayScope.SELECTED })
      .groupBy('cat.id')
      .addGroupBy('cat.name')
      .addGroupBy('cat.slug')
      .addGroupBy('cat.position')
      .orderBy('cat.position', 'ASC')
      .addOrderBy('cat.name', 'ASC')
      .getRawMany<CategoryCountRow>();
  }

  /** Estatísticas por vídeo para o painel do admin. */
  findStats(limit: number): Promise<VideoStatRow[]> {
    return this.visibleVideos()
      .leftJoin(PlayVideoViewEntity, 'view', 'view.mediaItemId = media.id')
      .select('media.id', 'id')
      .addSelect('media.title', 'title')
      .addSelect('page.name', 'galleryTitle')
      .addSelect('COUNT(view.id)', 'views')
      .addSelect('COUNT(DISTINCT view.userId)', 'viewers')
      .addSelect(
        '(SELECT COUNT(*) FROM play_video_progress pp WHERE pp.media_item_id = media.id AND pp.completed = 1)',
        'completed',
      )
      .addSelect('MAX(view.createdAt)', 'lastViewedAt')
      .groupBy('media.id')
      .addGroupBy('media.title')
      .addGroupBy('page.name')
      .orderBy('COUNT(view.id)', 'DESC')
      .addOrderBy('media.title', 'ASC')
      .limit(limit)
      .getRawMany<VideoStatRow>();
  }

  countVisible(): Promise<number> {
    return this.visibleVideos().getCount();
  }

  async countViews(): Promise<{ views: number; viewers: number }> {
    const row = await this.dataSource
      .createQueryBuilder()
      .from(PlayVideoViewEntity, 'view')
      .select('COUNT(view.id)', 'views')
      .addSelect('COUNT(DISTINCT view.userId)', 'viewers')
      .getRawOne<{ views: string; viewers: string }>();
    return {
      views: Number(row?.views ?? 0),
      viewers: Number(row?.viewers ?? 0),
    };
  }
}
