import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';

@Entity('pagelas')
@Unique('UQ_pagela_child_year_week', ['child', 'year', 'week'])
export class PagelaEntity extends BaseEntity {
  
  /**
   * Semana do ANO LETIVO (não semana ISO do ano calendário)
   * A primeira semana dentro do período letivo é a "semana 1" do ano letivo
   * Exemplo: Se o período letivo começa em 05/02/2024, essa é a semana 1 do ano letivo
   */
  @Column({ type: 'tinyint', unsigned: true })
  week: number;

  /**
   * Ano do período letivo (não ano calendário)
   * Exemplo: Ano letivo 2024 (período de 05/02/2024 a 15/12/2024)
   */
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

  @ManyToOne(() => TeacherProfileEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_profile_id' })
  teacher?: TeacherProfileEntity | null;
}
