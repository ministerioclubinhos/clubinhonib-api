import { Column, Entity } from 'typeorm';
import { BaseEntity } from 'src/share/share-entity/base.entity';

@Entity('documents')
export class DocumentEntity extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;
}
