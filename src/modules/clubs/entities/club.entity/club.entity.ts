import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, OneToOne, JoinColumn, OneToMany, ManyToOne } from 'typeorm';
import { Weekday } from '../../enums/weekday.enum/weekday.enum';
import { AddressEntity } from 'src/modules/addresses/entities/address.entity/address.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { CoordinatorProfileEntity } from 'src/modules/coordinator-profiles/entities/coordinator-profile.entity/coordinator-profile.entity';
import { ChildEntity } from 'src/modules/children/entities/child.entity';

@Entity('clubs')
export class ClubEntity extends BaseEntity {
  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'enum', enum: Weekday })
  weekday: Weekday;

  @Column({
    name: 'time',
    type: 'time',
    nullable: true,
    transformer: {
      to: (v?: string | null) => (v ? (v.length === 5 ? `${v}:00` : v) : v),
      from: (v?: string | null) => (typeof v === 'string' ? v.slice(0, 5) : v),
    },
  })
  time?: string | null;

  @OneToOne(() => AddressEntity, { cascade: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'address_id' })
  address: AddressEntity;

  @OneToMany(() => TeacherProfileEntity, (tp) => tp.club, { cascade: false })
  teachers: TeacherProfileEntity[];

  @ManyToOne(() => CoordinatorProfileEntity, (cp) => cp.clubs, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'coordinator_profile_id' })
  coordinator: CoordinatorProfileEntity | null;

  @OneToMany(() => ChildEntity, (child) => child.club, { cascade: false })
  children: ChildEntity[];
}
