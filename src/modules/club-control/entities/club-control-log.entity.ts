import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';

/**
 * Log de Controle dos Clubes
 * Registra histórico de verificações e alertas
 */
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
  expectedDate: string; // Data esperada da pagela

  @Column({ type: 'boolean' })
  hadPagela: boolean; // Se teve pagela

  @Column({ type: 'int', default: 0 })
  totalPagelas: number; // Quantidade de pagelas registradas

  @Column({ type: 'int', default: 0 })
  totalChildren: number; // Total de crianças cadastradas no clube

  @Column({ type: 'int', default: 0 })
  childrenWithPagela: number; // Crianças que tiveram pagela

  @Column({ type: 'enum', enum: ['ok', 'missing', 'partial', 'exception'], default: 'ok' })
  status: string;

  @Column({ type: 'text', nullable: true })
  alertMessage?: string | null; // Mensagem de alerta se houver problema

  @Column({ type: 'enum', enum: ['critical', 'warning', 'info'], nullable: true })
  severity?: string | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  checkedAt: Date; // Quando foi verificado
}

