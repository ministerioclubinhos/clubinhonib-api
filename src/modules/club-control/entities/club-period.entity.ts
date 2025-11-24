import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, Unique } from 'typeorm';

/**
 * Período Letivo GLOBAL
 * Define o período letivo para TODOS os clubes
 * 
 * REGRA: Um único período letivo por ano, válido para todos os clubes
 * 
 * Exemplo: Ano Letivo 2024 - 05/02/2024 a 15/12/2024
 * - Todos os clubes seguem o mesmo calendário
 * - A primeira semana dentro do período é a "semana 1" do ano letivo
 */
@Entity('academic_periods')
@Unique('UQ_academic_period_year', ['year'])
export class ClubPeriodEntity extends BaseEntity {
  @Column({ type: 'smallint', unsigned: true, unique: true })
  year: number; // Ano letivo (ex: 2024)

  @Column({ type: 'date' })
  startDate: string; // Data de início do ano letivo

  @Column({ type: 'date' })
  endDate: string; // Data de fim do ano letivo

  @Column({ type: 'varchar', length: 255, nullable: true })
  description?: string | null; // Ex: "Ano Letivo 2024"

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Se este período está ativo
}

