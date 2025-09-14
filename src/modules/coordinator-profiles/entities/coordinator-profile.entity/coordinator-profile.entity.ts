import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { BaseEntity } from 'src/share/share-entity/base.entity';
import { UserEntity } from 'src/user/user.entity';
import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  Unique,
  OneToMany,
} from 'typeorm';

@Unique('UQ_coordinator_profile_user', ['user'])
@Entity('coordinator_profiles')
export class CoordinatorProfileEntity extends BaseEntity {
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @OneToOne(() => UserEntity, (user) => user.coordinatorProfile, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToMany(() => ClubEntity, (club) => club.coordinator, { cascade: false })
  clubs: ClubEntity[];
}
