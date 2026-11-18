import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionSubmissionSnapshotEntity } from './ideas-section-submission-snapshot.entity';

@Entity('ideas_section_submission_snapshot_medias')
@Unique('uq_idea_snapshot_media_source', ['snapshotId', 'sourceMediaId'])
export class IdeasSectionSubmissionSnapshotMediaEntity extends BaseEntity {
  @Column({ name: 'snapshot_id', type: 'varchar', length: 36 })
  snapshotId: string;

  @ManyToOne(
    () => IdeasSectionSubmissionSnapshotEntity,
    (snapshot) => snapshot.medias,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({
    name: 'snapshot_id',
    foreignKeyConstraintName: 'fk_idea_snapshot_media_snapshot',
  })
  snapshot: IdeasSectionSubmissionSnapshotEntity;

  @Column({ name: 'source_media_id', type: 'varchar', length: 36 })
  sourceMediaId: string;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'source_media_id',
    foreignKeyConstraintName: 'fk_idea_snapshot_media_source',
  })
  sourceMedia: MediaItemEntity;

  @Column({ type: 'int' })
  position: number;

  @Column({
    name: 'original_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  originalName: string | null;

  @Column({ name: 'media_type', type: 'varchar', length: 32 })
  mediaType: string;

  @Column({ name: 'upload_type', type: 'varchar', length: 32 })
  uploadType: string;

  @Column({ type: 'text', nullable: true })
  url: string | null;
}
