import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column } from 'typeorm';
import { FeedbackCategory } from './feedback-category.enum';

@Entity('site_feedbacks')
export class SiteFeedbackEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  email?: string;

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text' })
  comment: string;

  @Column({
    type: 'enum',
    enum: FeedbackCategory,
  })
  category: FeedbackCategory;

  @Column({ type: 'boolean', default: false })
  read: boolean;
}
