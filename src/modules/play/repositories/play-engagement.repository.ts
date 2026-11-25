import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayVideoViewEntity } from '../entities/play-video-view.entity';
import { PlayVideoProgressEntity } from '../entities/play-video-progress.entity';
import { PlayFavoriteEntity } from '../entities/play-favorite.entity';

/** Persistência do que cada professor faz no Play: views, progresso e favoritos. */
@Injectable()
export class PlayEngagementRepository {
  constructor(
    @InjectRepository(PlayVideoViewEntity)
    private readonly views: Repository<PlayVideoViewEntity>,
    @InjectRepository(PlayVideoProgressEntity)
    private readonly progress: Repository<PlayVideoProgressEntity>,
    @InjectRepository(PlayFavoriteEntity)
    private readonly favorites: Repository<PlayFavoriteEntity>,
  ) {}

  /** Registra a visualização, salvo se o mesmo usuário já viu após `since`. */
  async recordView(
    userId: string,
    mediaItemId: string,
    since: Date,
  ): Promise<boolean> {
    const recent = await this.views
      .createQueryBuilder('view')
      .where('view.userId = :userId AND view.mediaItemId = :mediaItemId', {
        userId,
        mediaItemId,
      })
      .andWhere('view.createdAt > :since', { since })
      .getCount();
    if (recent > 0) return false;
    await this.views.save(this.views.create({ userId, mediaItemId }));
    return true;
  }

  async saveProgress(
    userId: string,
    mediaItemId: string,
    values: {
      positionSeconds: number;
      durationSeconds: number | null;
      completed: boolean;
    },
  ): Promise<void> {
    const existing = await this.progress.findOne({
      where: { userId, mediaItemId },
    });
    await this.progress.save(
      this.progress.create({ ...existing, userId, mediaItemId, ...values }),
    );
  }

  async addFavorite(userId: string, mediaItemId: string): Promise<void> {
    const exists = await this.favorites.count({
      where: { userId, mediaItemId },
    });
    if (exists === 0) {
      await this.favorites.save(this.favorites.create({ userId, mediaItemId }));
    }
  }

  async removeFavorite(userId: string, mediaItemId: string): Promise<void> {
    await this.favorites.delete({ userId, mediaItemId });
  }
}
