import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, ManyToOne, OneToOne, JoinColumn, Unique } from 'typeorm';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { UserEntity } from 'src/user/user.entity';

@Unique('UQ_teacher_profile_user', ['user'])
@Entity('teacher_profiles')
export class TeacherProfileEntity extends BaseEntity {
  @Column({ type: 'boolean', default: true })
  active: boolean;

  @ManyToOne(() => ClubEntity, (club) => club.teachers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'club_id' })
  club: ClubEntity | null;

  @OneToOne(() => UserEntity, (user) => user.teacherProfile, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
