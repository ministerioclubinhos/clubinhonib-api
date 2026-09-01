import { Injectable, Logger } from '@nestjs/common';
import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MeditationRepository } from '../repositories/meditation.repository';
import { MeditationResponseDto } from '../dto/meditation-response.dto';
import { MeditationEntity } from '../entities/meditation.entity';
import { toMeditationResponse } from '../mappers';
import { formatDateOnly, todayAsLocalDate } from '../utils';
import { MEDITATION_ENTITY_TYPE } from '../constants';

@Injectable()
export class GetMeditationService {
  private readonly logger = new Logger(GetMeditationService.name);

  constructor(
    private readonly meditationRepo: MeditationRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  /** Carrega a meditação ou falha com o erro documentado. */
  async findEntityOrFail(id: string): Promise<MeditationEntity> {
    const meditation = await this.meditationRepo.findOneWithDays(id);
    if (!meditation) {
      this.logger.warn(`Meditação não encontrada. ID=${id}`);
      throw new AppNotFoundException(
        ErrorCode.MEDITATION_NOT_FOUND,
        'Meditação não encontrada',
      );
    }
    return meditation;
  }

  /** Mídia associada à meditação, quando existir. */
  async findMediaOf(meditationId: string): Promise<MediaItemEntity | null> {
    return this.mediaItemProcessor.findMediaItemByTarget(
      meditationId,
      MEDITATION_ENTITY_TYPE,
    );
  }

  async findAll(): Promise<MeditationResponseDto[]> {
    const meditations = await this.meditationRepo.findAllWithDays();
    if (meditations.length === 0) return [];

    const mediaItems =
      await this.mediaItemProcessor.findManyMediaItemsByTargets(
        meditations.map((meditation) => meditation.id),
        MEDITATION_ENTITY_TYPE,
      );

    const mediaByMeditation = new Map<string, MediaItemEntity>();
    for (const item of mediaItems) {
      if (!mediaByMeditation.has(item.targetId)) {
        mediaByMeditation.set(item.targetId, item);
      }
    }

    return meditations.map((meditation) =>
      toMeditationResponse(
        meditation,
        mediaByMeditation.get(meditation.id) ?? null,
      ),
    );
  }

  async findOne(id: string): Promise<MeditationResponseDto> {
    const meditation = await this.findEntityOrFail(id);
    const media = await this.findMediaOf(meditation.id);
    return toMeditationResponse(meditation, media);
  }

  /**
   * Meditação cujo período cobre a data de hoje, ou `null`.
   *
   * A ausência de mídia não esconde a meditação: `media` volta `null` e os dias
   * continuam disponíveis, que é o que alimenta as rotas da semana.
   */
  async getThisWeekMeditation(): Promise<MeditationResponseDto | null> {
    const today = formatDateOnly(todayAsLocalDate());
    const meditation = await this.meditationRepo.findByDate(today);

    if (!meditation) {
      this.logger.debug('Nenhuma meditação cobre a data de hoje.');
      return null;
    }

    const media = await this.findMediaOf(meditation.id);
    if (!media) {
      this.logger.warn(
        `Meditação da semana sem mídia associada. ID=${meditation.id}`,
      );
    }

    return toMeditationResponse(meditation, media);
  }
}
