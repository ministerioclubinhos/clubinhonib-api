import { Injectable } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { PlayVideoEntryRepository } from '../repositories/play-video-entry.repository';
import { PlayVideoEntryEntity } from '../entities/play-video-entry.entity';
import { PlayAccessService } from './play-access.service';
import { QueryPlayVideosDto } from '../dto/query-play-videos.dto';
import {
  PlayCategoryResponseDto,
  PlayHomeResponseDto,
  PlayHomeSectionDto,
  PlayStatsResponseDto,
  PlayVideoResponseDto,
} from '../dto/play-video-response.dto';
import { toCategoryResponse, toPlayVideoResponse } from '../mappers';
import { PlaySectionKind, PlaySort } from '../enums/play-sort.enum';
import {
  PLAY_DEFAULT_LIMIT,
  PLAY_DEFAULT_PAGE,
  PLAY_HOME_FEATURED_SIZE,
  PLAY_HOME_MAX_CATEGORY_ROWS,
  PLAY_HOME_MAX_GALLERY_ROWS,
  PLAY_QUEUE_MAX,
  PLAY_HOME_ROW_SIZE,
  PLAY_RELATED_DEFAULT_LIMIT,
  PLAY_STATS_DEFAULT_LIMIT,
} from '../constants';
import { PlayVideoFilters } from '../types';

@Injectable()
export class GetPlayVideosService {
  constructor(
    private readonly repo: PlayVideoEntryRepository,
    private readonly access: PlayAccessService,
  ) {}

  async findAll(
    userId: string,
    query: QueryPlayVideosDto,
  ): Promise<Paginated<PlayVideoResponseDto>> {
    await this.access.assertEnabled();
    const page = query.page ?? PLAY_DEFAULT_PAGE;
    const limit = query.limit ?? PLAY_DEFAULT_LIMIT;
    const { rows, total } = await this.repo.findVideos({
      ...query,
      userId,
      page,
      limit,
    });
    return new Paginated(rows.map(toPlayVideoResponse), total, page, limit);
  }

  /**
   * Fila para "Tocar tudo" e "Aleatório": os vídeos que a busca/filtro atual
   * mostraria, na ordem pedida, sem paginação (até {@link PLAY_QUEUE_MAX}).
   */
  async findQueue(
    userId: string,
    query: QueryPlayVideosDto,
  ): Promise<PlayVideoResponseDto[]> {
    await this.access.assertEnabled();
    const { rows } = await this.repo.findVideos({
      ...query,
      userId,
      page: 1,
      limit: PLAY_QUEUE_MAX,
    });
    return rows.map(toPlayVideoResponse);
  }

  /** 404 se o vídeo não está no Play, mesmo que exista na galeria. */
  async findOne(userId: string, id: string): Promise<PlayVideoResponseDto> {
    await this.access.assertEnabled();
    return toPlayVideoResponse(await this.rowOrFail(userId, id));
  }

  private async rowOrFail(userId: string, id: string) {
    const row = await this.repo.findVideo(id, userId);
    if (!row) {
      throw new AppNotFoundException(
        ErrorCode.VIDEO_NOT_FOUND,
        'Vídeo não encontrado no Clubinho Play.',
      );
    }
    return row;
  }

  /** "Próximos vídeos": mesma galeria primeiro, depois mesma categoria, depois o resto. */
  async findRelated(
    userId: string,
    id: string,
    limit = PLAY_RELATED_DEFAULT_LIMIT,
  ): Promise<PlayVideoResponseDto[]> {
    await this.access.assertEnabled();
    const current = await this.rowOrFail(userId, id);
    const { rows } = await this.repo.findVideos({
      userId,
      limit,
      excludeId: id,
      relatedToGalleryId: current.galleryId,
      relatedToCategoryId: current.categoryId,
    });
    return rows.map(toPlayVideoResponse);
  }

  async listCategories(): Promise<PlayCategoryResponseDto[]> {
    await this.access.assertEnabled();
    return (await this.repo.findCategoriesWithCount()).map(toCategoryResponse);
  }

  /** Home em fileiras: destaques, continuar, novidades, mais vistos, categorias e galerias. */
  async findHome(userId: string): Promise<PlayHomeResponseDto> {
    await this.access.assertEnabled();

    const row = async (
      id: string,
      kind: PlaySectionKind,
      title: string,
      filters: Partial<PlayVideoFilters>,
      extra: Partial<PlayHomeSectionDto> = {},
    ): Promise<PlayHomeSectionDto> => {
      const { rows } = await this.repo.findVideos({
        userId,
        limit: PLAY_HOME_ROW_SIZE,
        ...filters,
      });
      return {
        id,
        kind,
        title,
        videos: rows.map(toPlayVideoResponse),
        ...extra,
      };
    };

    const [categories, galleries] = await Promise.all([
      this.repo.findCategoriesWithCount(),
      this.repo.findGalleries(PLAY_HOME_MAX_GALLERY_ROWS),
    ]);

    const sections: PlayHomeSectionDto[] = await Promise.all([
      row('featured', PlaySectionKind.FEATURED, 'Destaques', {
        featured: true,
        limit: PLAY_HOME_FEATURED_SIZE,
      }),
      row('continue', PlaySectionKind.CONTINUE, 'Continuar assistindo', {
        inProgress: true,
        sort: PlaySort.CONTINUE,
      }),
      row('latest', PlaySectionKind.LATEST, 'Novidades', {
        sort: PlaySort.RECENT,
      }),
      row('popular', PlaySectionKind.POPULAR, 'Mais vistos', {
        sort: PlaySort.POPULAR,
      }),
      ...categories
        .filter((category) => Number(category.videoCount) > 0)
        .slice(0, PLAY_HOME_MAX_CATEGORY_ROWS)
        .map((category) =>
          row(
            `category-${category.id}`,
            PlaySectionKind.CATEGORY,
            category.name,
            { categoryId: category.id },
            { categoryId: category.id },
          ),
        ),
      ...galleries.map((gallery) =>
        row(
          `gallery-${gallery.id}`,
          PlaySectionKind.GALLERY,
          gallery.title,
          { galleryId: gallery.id },
          { galleryId: gallery.id },
        ),
      ),
    ]);

    return {
      sections: sections
        .map((section) =>
          // Sem nenhuma visualização, "Mais vistos" não diz nada.
          section.kind === PlaySectionKind.POPULAR
            ? {
                ...section,
                videos: section.videos.filter((video) => video.viewCount > 0),
              }
            : section,
        )
        .filter((section) => section.videos.length > 0),
    };
  }

  /** Galerias que podem receber vídeos aprovados. */
  listPlayGalleries(): Promise<{ id: string; title: string; scope: string }[]> {
    return this.repo.findPlayGalleries();
  }

  /** Painel do admin: números de visualização. */
  async stats(limit = PLAY_STATS_DEFAULT_LIMIT): Promise<PlayStatsResponseDto> {
    const [rows, totals, totalVideos] = await Promise.all([
      this.repo.findStats(limit),
      this.repo.countViews(),
      this.repo.countVisible(),
    ]);
    return {
      totalVideos,
      totalViews: totals.views,
      totalViewers: totals.viewers,
      videos: rows.map((row) => ({
        id: row.id,
        title: row.title,
        galleryTitle: row.galleryTitle,
        views: Number(row.views),
        viewers: Number(row.viewers),
        completed: Number(row.completed),
        lastViewedAt: row.lastViewedAt
          ? row.lastViewedAt instanceof Date
            ? row.lastViewedAt.toISOString()
            : String(row.lastViewedAt)
          : null,
      })),
    };
  }

  /** Linhas de Play de uma galeria, para o painel do admin. */
  findEntriesOf(videosPageId: string): Promise<PlayVideoEntryEntity[]> {
    return this.repo.findByPage(videosPageId);
  }
}
