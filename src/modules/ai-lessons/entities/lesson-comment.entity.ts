import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { LessonEntity } from './lesson.entity';

@Entity('lesson_comments')
export class LessonCommentEntity extends BaseEntity {
  @ManyToOne(() => LessonEntity, (lesson) => lesson.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'lesson_id' })
  lesson: LessonEntity;

  @Column({ type: 'varchar', length: 100 })
  sectionKey: string;

  @Column({ type: 'text' })
  commentText: string;

  @Column({ type: 'boolean', default: false })
  isResolved: boolean;

  @Column({ type: 'varchar', length: 36 })
  authorId: string;
}
