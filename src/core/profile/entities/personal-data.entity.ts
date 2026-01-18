import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { UserEntity } from '../../user/entities/user.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

@Entity('personal_data')
export class PersonalData extends BaseEntity {
  @Column({ type: 'date', nullable: true })
  birthDate?: string | Date;

  @Column({ nullable: true })
  gender?: string;

  @Column({ nullable: true })
  gaLeaderName?: string;

  @Column({ nullable: true })
  gaLeaderContact?: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: UserEntity;

  @Column()
  userId: string;
}
