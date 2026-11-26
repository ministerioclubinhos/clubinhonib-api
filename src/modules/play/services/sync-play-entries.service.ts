import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { PlayVideoEntryRepository } from '../repositories/play-video-entry.repository';
import { PlayCategoryRepository } from '../repositories/play-category.repository';
import { PlayVideoEntryEntity } from '../entities/play-video-entry.entity';
import { PlayScope } from '../enums/play-scope.enum';
import { PlayConfigDto } from '../dto/play-config.dto';
import { PlayFilesDict, PlayUploadFn, PlayVideoFlags } from '../types';
import {
  assertPlayPayload,
  assertThumbnails,
  buildEntryInputs,
  PreviousEntryData,
} from '../utils';

export interface SyncPlayResult {
  entries: PlayVideoEntryEntity[];
  /** Miniaturas que deixaram de ser usadas; apagar do S3 só após o commit. */
  removedUrls: string[];
}

/** Grava os atributos de Play dos vídeos de uma galeria (dentro da transação do chamador). */
@Injectable()
export class SyncPlayEntriesService {
  constructor(
    private readonly repo: PlayVideoEntryRepository,
    private readonly categories: PlayCategoryRepository,
  ) {}

  /**
   * Valida o payload antes da primeira escrita e devolve a categoria que a
   * galeria deve ter: ausente mantém `currentCategoryId`, `null` remove.
   */
  async validate(
    play: PlayConfigDto | undefined,
    videos: PlayVideoFlags[],
    files: PlayFilesDict,
    currentCategoryId: string | null,
  ): Promise<string | null> {
    assertPlayPayload(play, videos);
    assertThumbnails(videos, files);

    if (!play || play.categoryId === undefined) return currentCategoryId;
    if (play.categoryId === null) return null;

    const category = await this.categories.findById(play.categoryId);
    if (!category) {
      const message =
        'A categoria escolhida não existe mais. Recarregue a página.';
      throw new AppValidationException(ErrorCode.INVALID_INPUT, message, {
        fieldErrors: [{ field: 'play.categoryId', message }],
      });
    }
    return category.id;
  }

  /** Publica um vídeo já aprovado na galeria (escopo `all` ou `selected`). */
  addApproved(
    videosPageId: string,
    mediaItemId: string,
    values: {
      thumbnailUrl: string | null;
      durationSeconds: number | null;
      featured: boolean;
    },
    manager: EntityManager,
  ): Promise<PlayVideoEntryEntity> {
    return this.repo.addEntry(
      videosPageId,
      { mediaItemId, position: null, ...values },
      manager,
    );
  }

  /**
   * `mediaIds` acompanha `videos` posição a posição. Envia as miniaturas novas,
   * preserva as antigas de quem não mandou outra e devolve o que sobrou.
   */
  async execute(
    videosPageId: string,
    scope: PlayScope,
    mediaIds: string[],
    videos: PlayVideoFlags[],
    manager: EntityManager,
    files: PlayFilesDict,
    upload: PlayUploadFn,
  ): Promise<SyncPlayResult> {
    const previousEntries = await this.repo.findByPage(videosPageId, manager);
    const previous = new Map<string, PreviousEntryData>(
      previousEntries.map((entry) => [entry.mediaItemId, entry]),
    );

    const thumbnails: (string | null)[] = [];
    for (const video of videos) {
      const file = video.thumbnailField
        ? files[video.thumbnailField]
        : undefined;
      thumbnails.push(file ? await upload(file) : null);
    }

    const entries = await this.repo.replaceForPage(
      videosPageId,
      buildEntryInputs(scope, mediaIds, videos, thumbnails, previous),
      manager,
    );

    const stillUsed = new Set(entries.map((entry) => entry.thumbnailUrl));
    const removedUrls = previousEntries
      .map((entry) => entry.thumbnailUrl)
      .filter((url): url is string => Boolean(url) && !stillUsed.has(url));

    return { entries, removedUrls };
  }
}
