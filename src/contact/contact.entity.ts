import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column } from 'typeorm';

@Entity('contacts')
export class ContactEntity extends BaseEntity {

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  phone: string;

  @Column('text')
  message: string;

  @Column({ type: 'boolean', default: false })
  read: boolean;
}
