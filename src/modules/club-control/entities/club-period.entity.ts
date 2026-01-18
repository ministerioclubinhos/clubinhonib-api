import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { Entity, Column, Unique } from 'typeorm';


@Entity('academic_periods')
@Unique('UQ_academic_period_year', ['year'])
export class ClubPeriodEntity extends BaseEntity {
  @Column({ type: 'smallint', unsigned: true, unique: true })
  year: number; 

  @Column({ type: 'date' })
  startDate: string; 

  @Column({ type: 'date' })
  endDate: string; 

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null; 

  @Column({ type: 'boolean', default: true })
  isActive: boolean; 
}

