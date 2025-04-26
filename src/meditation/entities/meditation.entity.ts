import { Column, Entity, OneToMany } from 'typeorm';
import { DayEntity } from './day.entity';
import { BaseEntity } from 'src/share/share-entity/base.entity';

@Entity('meditations')
export class MeditationEntity extends BaseEntity {
  @Column()
  topic: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @OneToMany(() => DayEntity, (day) => day.meditation, {
    cascade: true,
    eager: true,
  })
  days: DayEntity[];
}
