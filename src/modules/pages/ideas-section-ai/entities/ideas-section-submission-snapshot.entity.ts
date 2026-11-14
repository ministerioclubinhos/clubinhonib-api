import { Column, Entity, JoinColumn, OneToMany, OneToOne } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { IdeaSubmissionSnapshotSource } from '../enums/ideas-section-ai.enums';
import { IdeasSectionSubmissionSnapshotMediaEntity } from './ideas-section-submission-snapshot-media.entity';

@Entity('ideas_section_submission_snapshots')
export class IdeasSectionSubmissionSnapshotEntity extends BaseEntity {
  @Column({ name: 'section_id', type: 'varchar', length: 36, unique: true })
  sectionId: string;

  @OneToOne(() => IdeasSectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'section_id',
    foreignKeyConstraintName: 'fk_idea_snapshot_section',
  })
  section: IdeasSectionEntity;

  @Column({ name: 'submitted_title', type: 'varchar', length: 255 })
  submittedTitle: string;

  @Column({ name: 'submitted_description', type: 'text' })
  submittedDescription: string;

  @Column({ name: 'submitted_at', type: 'datetime' })
  submittedAt: Date;

  @Column({ type: 'enum', enum: IdeaSubmissionSnapshotSource })
  source: IdeaSubmissionSnapshotSource;

  @OneToMany(
    () => IdeasSectionSubmissionSnapshotMediaEntity,
    (media) => media.snapshot,
    {
      cascade: ['insert'],
    },
  )
  medias: IdeasSectionSubmissionSnapshotMediaEntity[];
}
