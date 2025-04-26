import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column } from 'typeorm';

@Entity('comments')
export class CommentEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'varchar', length: 100 })
  clubinho: string;

  @Column({ type: 'varchar', length: 100 })
  neighborhood: string;

  @Column({ type: 'boolean', default: false })
  published?: boolean;
}
