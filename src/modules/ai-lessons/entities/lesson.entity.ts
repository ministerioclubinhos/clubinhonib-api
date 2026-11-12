import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { LessonCommentEntity } from './lesson-comment.entity';
import { LessonStageEntity } from './lesson-stage.entity';
import { LessonCategory, LessonStatus } from '../enums/lesson.enums';

@Entity('lessons')
export class LessonEntity extends BaseEntity {
  @Column({ type: 'int', nullable: true })
  weekNumber: number | null;

  @Column({
    type: 'enum',
    enum: LessonCategory,
    default: LessonCategory.REGULAR,
  })
  category: LessonCategory;

  @Column({ name: 'special_context', type: 'text', nullable: true })
  specialContext: string | null;

  /** Purpose / central message set by the admin; steers every generation. */
  @Column({ name: 'editorial_purpose', type: 'text', nullable: true })
  editorialPurpose: string | null;

  @Column({ type: 'varchar', length: 255 })
  theme: string;

  @Column({ type: 'varchar', length: 500 })
  biblicalReference: string;

  @Column({
    type: 'enum',
    enum: LessonStatus,
    default: LessonStatus.DRAFT,
  })
  status: LessonStatus;

  @Column({ type: 'varchar', length: 36 })
  createdById: string;

  @Index('idx_lessons_week_material_id')
  @Column({
    name: 'week_material_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  weekMaterialId: string | null;

  @Column({
    name: 'publication_lease_owner',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  publicationLeaseOwner: string | null;

  @Column({
    name: 'publication_lease_until',
    type: 'datetime',
    nullable: true,
  })
  publicationLeaseUntil: Date | null;

  @Column({
    name: 'publication_reserved_versions_json',
    type: 'json',
    nullable: true,
  })
  publicationReservedVersionsJson: Record<string, string> | null;

  @Column({
    name: 'publication_failure_message',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  publicationFailureMessage: string | null;

  @OneToMany(() => LessonStageEntity, (stage) => stage.lesson, {
    cascade: true,
  })
  stages: LessonStageEntity[];

  @OneToMany(() => LessonCommentEntity, (c) => c.lesson, { cascade: true })
  comments: LessonCommentEntity[];
}
