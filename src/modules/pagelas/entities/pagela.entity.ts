import { UserEntity } from 'src/core/user/entities/user.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';

@Entity('pagelas')
@Unique('UQ_pagela_child_year_week', ['child', 'year', 'week'])
export class PagelaEntity extends BaseEntity {
  @Column({ type: 'tinyint', unsigned: true })
  week: number;

  @Column({ type: 'smallint', unsigned: true })
  year: number;

  @Column({ type: 'date' })
  referenceDate: string;

  @Column({ type: 'boolean', default: false })
  present: boolean;

  @Column({ type: 'boolean', default: false })
  didMeditation: boolean;

  @Column({ type: 'boolean', default: false })
  recitedVerse: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes?: string | null;

  @ManyToOne(() => ChildEntity, (child) => child.pagelas, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'child_id' })
  child: ChildEntity;

  @ManyToOne(() => TeacherProfileEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacher?: TeacherProfileEntity | null;

  /**
   * Quem lançou a pagela. `null` em registros anteriores a esta coluna ou
   * quando o usuário foi excluído depois.
   */
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy?: UserEntity | null;

  /** Quem fez a última alteração na pagela. */
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by_user_id' })
  updatedBy?: UserEntity | null;
}
