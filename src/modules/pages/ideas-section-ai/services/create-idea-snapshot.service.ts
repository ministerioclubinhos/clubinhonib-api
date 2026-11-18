import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { IdeasSectionEntity } from '../../ideas-page/entities/ideas-section.entity';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { IdeasSectionSubmissionSnapshotEntity } from '../entities/ideas-section-submission-snapshot.entity';
import { IdeaSubmissionSnapshotSource } from '../enums/ideas-section-ai.enums';
@Injectable()
export class CreateIdeaSnapshotService {
  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly media: MediaItemProcessor,
  ) {}
  /** Caller holds the section lock. Sources get their own immutable rows, never S3 copies. */
  async capture(
    section: IdeasSectionEntity,
    medias: MediaItemEntity[],
    manager: EntityManager,
    source = IdeaSubmissionSnapshotSource.LEGACY_CAPTURE,
  ): Promise<IdeasSectionSubmissionSnapshotEntity> {
    const existing = await this.repo.snapshot(section.id, manager);
    if (existing) return existing;
    const sources: MediaItemEntity[] = [];
    for (const item of medias) {
      sources.push(
        await this.media.saveMediaItemInTransaction(manager, {
          title: item.title,
          description: item.description,
          mediaType: item.mediaType,
          uploadType: item.uploadType,
          platformType: item.platformType,
          url: item.url,
          originalName: item.originalName,
          size: item.size,
          isLocalFile: item.isLocalFile,
          targetId: section.id,
          targetType: MediaTargetType.IdeasSectionSubmissionSource,
        }),
      );
    }
    return this.repo.saveSnapshot(
      {
        sectionId: section.id,
        submittedTitle: section.title,
        submittedDescription: section.description,
        submittedAt:
          source === IdeaSubmissionSnapshotSource.SUBMISSION
            ? section.createdAt
            : new Date(),
        source,
        medias: sources.map((item, position) => ({
          sourceMediaId: item.id,
          sourceMedia: item,
          position,
          originalName: item.originalName ?? null,
          mediaType: item.mediaType,
          uploadType: item.uploadType,
          url: item.url,
        })),
      },
      manager,
    );
  }
}
