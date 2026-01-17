import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
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
