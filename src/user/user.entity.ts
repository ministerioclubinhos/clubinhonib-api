import { UserRole } from 'src/auth/auth.types';
import { CoordinatorProfileEntity } from 'src/modules/coordinator-profiles/entities/coordinator-profile.entity/coordinator-profile.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, OneToOne } from 'typeorm';


@Entity('users')
export class UserEntity extends BaseEntity {
  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column()
  phone: string;

  @Column()
  name: string;

  @Column({ type: 'boolean', default: false })
  active: boolean;

  @Column({ type: 'boolean', default: false })
  completed: boolean;

  @Column({ type: 'boolean', default: true })
  commonUser: boolean;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.TEACHER })
  role: UserRole;

  @Column({ nullable: true, type: 'text' })
  refreshToken: string | null;

  @OneToOne(() => TeacherProfileEntity, (p) => p.user)
  teacherProfile?: TeacherProfileEntity | null;

  @OneToOne(() => CoordinatorProfileEntity, (p) => p.user)
  coordinatorProfile?: CoordinatorProfileEntity | null;
}
