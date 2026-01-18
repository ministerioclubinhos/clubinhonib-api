import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

@Entity('events')
export class EventEntity extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'date' })
  date: Date;

  @Column()
  location: string;

  @Column({ type: 'text' })
  description: string;
}
