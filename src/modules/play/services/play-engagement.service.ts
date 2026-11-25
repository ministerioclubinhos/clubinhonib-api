import { Injectable } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { PlayVideoEntryRepository } from '../repositories/play-video-entry.repository';
import { PlayEngagementRepository } from '../repositories/play-engagement.repository';
import { PlayAccessService } from './play-access.service';
import { SavePlayProgressDto } from '../dto/play-engagement.dto';
import { PLAY_COMPLETED_RATIO, PLAY_VIEW_DEDUPE_MINUTES } from '../constants';

/** O que cada professor faz nos vídeos: visualizar, retomar de onde parou e favoritar. */
@Injectable()
export class PlayEngagementService {
  constructor(
    private readonly entries: PlayVideoEntryRepository,
    private readonly repo: PlayEngagementRepository,
    private readonly access: PlayAccessService,
  ) {}

  private async assertVisible(id: string): Promise<void> {
    await this.access.assertEnabled();
    if (!(await this.entries.isVisible(id))) {
      throw new AppNotFoundException(
        ErrorCode.VIDEO_NOT_FOUND,
        'Vídeo não encontrado no Clubinho Play.',
      );
    }
  }

  /** Conta uma visualização por professor a cada janela de 30 minutos. */
  async recordView(userId: string, id: string): Promise<{ counted: boolean }> {
    await this.assertVisible(id);
    const since = new Date(Date.now() - PLAY_VIEW_DEDUPE_MINUTES * 60_000);
    return { counted: await this.repo.recordView(userId, id, since) };
  }

  async saveProgress(
    userId: string,
    id: string,
    dto: SavePlayProgressDto,
  ): Promise<void> {
    await this.assertVisible(id);
    const duration = dto.durationSeconds ?? null;
    const completed =
      duration !== null &&
      dto.positionSeconds >= duration * PLAY_COMPLETED_RATIO;
    await this.repo.saveProgress(userId, id, {
      positionSeconds: completed ? 0 : dto.positionSeconds,
      durationSeconds: duration,
      completed,
    });
  }

  async setFavorite(
    userId: string,
    id: string,
    favorite: boolean,
  ): Promise<void> {
    await this.assertVisible(id);
    if (favorite) await this.repo.addFavorite(userId, id);
    else await this.repo.removeFavorite(userId, id);
  }
}
