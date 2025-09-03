// src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity.ts
import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, ManyToOne, OneToOne, JoinColumn, Unique, Index } from 'typeorm';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { UserEntity } from 'src/user/user.entity';

@Unique('UQ_teacher_profile_user', ['user']) // 1 perfil por usuário
@Entity('teacher_profiles')
export class TeacherProfileEntity extends BaseEntity {
  @Column({ type: 'boolean', default: true })
  active: boolean;

  // ✅ teacher pode não ter club → nullable: true e onDelete: SET NULL
  @ManyToOne(() => ClubEntity, (club) => club.teachers, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'club_id' })
  club: ClubEntity | null;

  // 1:1 com usuário (obrigatório) — pode manter um índice normal para buscas
  @OneToOne(() => UserEntity, (user) => user.teacherProfile, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  @Index() // índice normal (NÃO único)
  user: UserEntity;
}
