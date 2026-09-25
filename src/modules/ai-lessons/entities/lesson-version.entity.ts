import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { LessonStageEntity } from './lesson-stage.entity';
import { LessonVersionSource } from '../enums/lesson.enums';

@Entity('lesson_versions')
@Unique('uq_lesson_version_stage_number', ['stageId', 'versionNumber'])
export class LessonVersionEntity extends BaseEntity {
  @ManyToOne(() => LessonStageEntity, (stage) => stage.versions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'stage_id' })
  stage: LessonStageEntity;

  @Column({ name: 'stage_id', type: 'varchar', length: 36 })
  stageId: string;

  @Column({ type: 'int' })
  versionNumber: number;

  @Column({ type: 'json' })
  tiptapAstJson: Record<string, unknown>;

  @Column({ type: 'json', nullable: true })
  structuredDataJson: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  docxS3Key: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  pdfS3Key: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  changeSummary: string;

  @Column({
    type: 'enum',
    enum: LessonVersionSource,
    default: LessonVersionSource.AI_GENERATED,
  })
  createdSource: LessonVersionSource;

  @Column({
    name: 'openai_response_id',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  openAiResponseId: string | null;

  @Column({ name: 'admin_prompt_snapshot', type: 'text', nullable: true })
  adminPromptSnapshot: string | null;

  @Column({
    name: 'admin_prompt_checksum',
    type: 'char',
    length: 64,
    nullable: true,
  })
  adminPromptChecksum: string | null;

  @Column({ name: 'content_checksum', type: 'char', length: 64 })
  contentChecksum: string;

  @Column({ type: 'varchar', length: 36 })
  createdById: string;
}
