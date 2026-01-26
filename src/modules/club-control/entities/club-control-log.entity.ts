import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';

@Entity('club_control_logs')
export class ClubControlLogEntity extends BaseEntity {
  @ManyToOne(() => ClubEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'club_id' })
  club: ClubEntity;

  @Column({ type: 'smallint', unsigned: true })
  year: number;

  @Column({ type: 'tinyint', unsigned: true })
  week: number;

  @Column({ type: 'date' })
  expectedDate: string;

  @Column({ type: 'boolean' })
  hadPagela: boolean;

  @Column({ type: 'int', default: 0 })
  totalPagelas: number;

  @Column({ type: 'int', default: 0 })
  totalChildren: number;

  @Column({ type: 'int', default: 0 })
  childrenWithPagela: number;

  @Column({
    type: 'enum',
    enum: ['ok', 'missing', 'partial', 'exception'],
    default: 'ok',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  alertMessage?: string | null;

  @Column({
    type: 'enum',
    enum: ['critical', 'warning', 'info'],
    nullable: true,
  })
  severity?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  checkedAt: Date;
}
