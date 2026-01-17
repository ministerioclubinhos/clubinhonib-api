import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, Unique } from 'typeorm';


@Entity('weekday_exceptions')
@Unique('UQ_weekday_exception_date', ['exceptionDate'])
export class ClubExceptionEntity extends BaseEntity {
  @Column({ type: 'date', unique: true })
  exceptionDate: string; 

  @Column({ type: 'varchar', length: 255 })
  reason: string; 

  @Column({ type: 'enum', enum: ['holiday', 'event', 'maintenance', 'vacation', 'other'], default: 'other' })
  type: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null; 

  @Column({ type: 'boolean', default: true })
  isActive: boolean; 

  @Column({ type: 'boolean', default: true })
  isRecurrent: boolean; 
}

