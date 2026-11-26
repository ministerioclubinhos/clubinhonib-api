import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
@Injectable()
export class DeleteIdeaAiAssetsService {
  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly media: MediaItemProcessor,
  ) {}
  /** Called in the transaction deleting the idea. Fences workers before removing sources. */
  async remove(sectionId: string, manager: EntityManager): Promise<string[]> {
    await this.repo.lockSection(sectionId, manager);
    await this.repo.deleteHistory(sectionId, manager);
    const urls: string[] = [];
    for (const type of [
      MediaTargetType.IdeasSectionSubmissionSource,
      MediaTargetType.IdeasSectionAiEnhancedMedia,
    ]) {
      const items = await this.media.findMediaItemsByTargetInTransaction(
        manager,
        sectionId,
        type,
      );
      urls.push(...items.filter((i) => i.isLocalFile).map((i) => i.url));
      await this.media.deleteMediaItemsByTargetInTransaction(
        manager,
        sectionId,
        type,
      );
    }
    return urls;
  }
}
