import { Column, Entity, OneToMany } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { LessonCommentEntity } from './lesson-comment.entity';
import { LessonStageEntity } from './lesson-stage.entity';
import { LessonStatus } from '../enums/lesson.enums';

@Entity('lessons')
export class LessonEntity extends BaseEntity {
  @Column({ type: 'int', nullable: true })
  weekNumber: number;

  @Column({ type: 'varchar', length: 255 })
  theme: string;

  @Column({ type: 'varchar', length: 255 })
  biblicalReference: string;

  @Column({
    type: 'enum',
    enum: LessonStatus,
    default: LessonStatus.DRAFT,
  })
  status: LessonStatus;

  @Column({ type: 'varchar', length: 36 })
  createdById: string;

  @OneToMany(() => LessonStageEntity, (stage) => stage.lesson, { cascade: true })
  stages: LessonStageEntity[];

  @OneToMany(() => LessonCommentEntity, (c) => c.lesson, { cascade: true })
  comments: LessonCommentEntity[];
}
