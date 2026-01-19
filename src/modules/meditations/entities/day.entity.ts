import { Column, Entity, ManyToOne } from 'typeorm';
import { MeditationEntity } from '../../../modules/meditations/entities/meditation.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

export enum WeekDay {
  Monday = 'Monday',
  Tuesday = 'Tuesday',
  Wednesday = 'Wednesday',
  Thursday = 'Thursday',
  Friday = 'Friday',
}

@Entity('meditation_days')
export class DayEntity extends BaseEntity {
  @Column({
    type: 'enum',
    enum: WeekDay,
  })
  day: WeekDay;

  @Column('text')
  verse: string;

  @Column()
  topic: string;

  @ManyToOne(() => MeditationEntity, (meditation) => meditation.days, {
    onDelete: 'CASCADE',
  })
  meditation: MeditationEntity;
}
