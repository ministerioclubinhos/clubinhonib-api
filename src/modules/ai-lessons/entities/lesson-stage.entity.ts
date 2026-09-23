import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany, Unique, VersionColumn } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { LessonEntity } from './lesson.entity';
import { LessonVersionEntity } from './lesson-version.entity';
import { LessonStageStatus, LessonStageType } from '../enums/lesson.enums';

@Entity('lesson_stages')
@Unique('uq_lesson_stage_type', ['lessonId', 'type'])
@Index('idx_lesson_stage_status', ['status'])
@Index('idx_lesson_stage_lesson_id', ['lessonId'])
export class LessonStageEntity extends BaseEntity {
  @Column({ name: 'lesson_id', type: 'varchar', length: 36 })
  lessonId: string;

  @ManyToOne(() => LessonEntity, (lesson) => lesson.stages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id', foreignKeyConstraintName: 'fk_lesson_stage_lesson_v2' })
  lesson: LessonEntity;

  @Column({ type: 'enum', enum: LessonStageType })
  type: LessonStageType;

  @Column({ type: 'enum', enum: LessonStageStatus, default: LessonStageStatus.NOT_STARTED })
  status: LessonStageStatus;

  @Column({ name: 'current_version_id', type: 'varchar', length: 36, nullable: true })
  currentVersionId: string | null;

  @Column({ name: 'template_key', type: 'varchar', length: 80 })
  templateKey: string;

  @Column({ name: 'template_version', type: 'varchar', length: 32 })
  templateVersion: string;

  @Column({ name: 'template_checksum', type: 'char', length: 64 })
  templateChecksum: string;

  @Column({ name: 'failure_code', type: 'varchar', length: 80, nullable: true })
  failureCode: string | null;

  @Column({ name: 'failure_message', type: 'varchar', length: 500, nullable: true })
  failureMessage: string | null;

  @Column({ name: 'approved_by_id', type: 'varchar', length: 36, nullable: true })
  approvedById: string | null;

  @Column({ name: 'approved_at', type: 'datetime', nullable: true })
  approvedAt: Date | null;

  @VersionColumn({ name: 'lock_version' })
  lockVersion: number;

  @OneToMany(() => LessonVersionEntity, (version) => version.stage)
  versions: LessonVersionEntity[];
}
