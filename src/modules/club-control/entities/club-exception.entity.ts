import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { Entity, Column, Unique } from 'typeorm';

@Entity('weekday_exceptions')
@Unique('UQ_weekday_exception_date', ['exceptionDate'])
export class ClubExceptionEntity extends BaseEntity {
  @Column({ type: 'date', unique: true })
  exceptionDate: string;

  @Column({ type: 'varchar', length: 255 })
  reason: string;

  @Column({
    type: 'enum',
    enum: ['holiday', 'event', 'maintenance', 'vacation', 'other'],
    default: 'other',
  })
  type: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Vale para o mesmo dia e mês em qualquer ano.
   *
   * Nasce desligado: uma exceção recorrente apaga aquele dia do calendário de
   * todos os anos seguintes, e isso precisa ser escolha de quem cadastra.
   */
  @Column({ type: 'boolean', default: false })
  isRecurrent: boolean;
}
