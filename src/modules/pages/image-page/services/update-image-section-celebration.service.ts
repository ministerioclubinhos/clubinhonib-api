import { Injectable } from '@nestjs/common';
import { ImageSectionCelebrationsRepository } from '../repositories/image-section-celebrations.repository';
import { ImageSectionCelebrationResponseDto } from '../dto/image-section-celebration-response.dto';
import { EMPTY_CELEBRATION } from '../constants';
import { summarizeCelebrations } from '../utils';

/** Alterna a celebração de uma publicação do feed. */
@Injectable()
export class UpdateImageSectionCelebrationService {
  constructor(
    private readonly repository: ImageSectionCelebrationsRepository,
  ) {}

  async toggle(
    sectionId: string,
    userId: string | null,
  ): Promise<ImageSectionCelebrationResponseDto> {
    if (!userId) return { ...EMPTY_CELEBRATION, celebrators: [] };
    const authorId = await this.repository.findSectionAuthorId(sectionId);
    if (authorId === undefined)
      return { ...EMPTY_CELEBRATION, celebrators: [] };
    if (authorId === userId)
      return { ...EMPTY_CELEBRATION, celebrators: [], ownPublication: true };
    const celebrated = await this.repository.toggle(sectionId, userId);
    const summary = summarizeCelebrations(
      await this.repository.findBySections([sectionId]),
      userId,
    ).get(sectionId);
    return {
      celebrated,
      celebrationCount: summary?.count ?? 0,
      celebrators: summary?.names ?? [],
    };
  }
}
