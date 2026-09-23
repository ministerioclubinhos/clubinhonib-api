import { Column, Entity, Index, Unique, VersionColumn } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { LessonStageType } from '../enums/lesson.enums';

@Entity('admin_lesson_prompts')
@Unique('uq_admin_lesson_prompt_stage', ['adminId', 'stage'])
@Index('idx_admin_lesson_prompt_admin', ['adminId'])
export class AdminLessonPromptEntity extends BaseEntity {
  @Column({ name: 'admin_id', type: 'varchar', length: 36 })
  adminId: string;

  @Column({ type: 'enum', enum: LessonStageType })
  stage: LessonStageType;

  @Column({ name: 'custom_prompt', type: 'text' })
  customPrompt: string;

  @VersionColumn({ name: 'lock_version' })
  lockVersion: number;
}
