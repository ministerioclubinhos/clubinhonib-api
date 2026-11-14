import { Column, Entity, OneToMany } from 'typeorm';
import { DayEntity } from './day.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

@Entity('meditations')
export class MeditationEntity extends BaseEntity {
  @Column()
  topic: string;

  /** Data no formato `YYYY-MM-DD`; colunas `date` chegam como string. */
  @Column({ type: 'date' })
  startDate: string;

  /** Data no formato `YYYY-MM-DD`; colunas `date` chegam como string. */
  @Column({ type: 'date' })
  endDate: string;

  @OneToMany(() => DayEntity, (day) => day.meditation, {
    cascade: true,
    eager: true,
  })
  days: DayEntity[];
}
