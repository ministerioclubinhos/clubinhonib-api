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
  Index,
} from 'typeorm';

// garante 1 profile por usuário
@Unique('UQ_coordinator_profile_user', ['user'])
@Entity('coordinator_profiles')
export class CoordinatorProfileEntity extends BaseEntity {
  @Column({ type: 'boolean', default: true })
  active: boolean;

  // 1:1 — um coordinator profile aponta para um User
  @OneToOne(() => UserEntity, (user) => user.coordinatorProfile, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  @Index()
  user: UserEntity;

  // 1:N — um coordinator profile possui vários Clubs
  @OneToMany(() => ClubEntity, (club) => club.coordinator, { cascade: false })
  clubs: ClubEntity[];
}
