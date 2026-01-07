import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column, Unique } from 'typeorm';

/**
 * Exceções de Funcionamento GLOBAIS
 * Define datas específicas onde NENHUM clube deve funcionar
 *
 * REGRA: Quando uma exceção é criada para uma data específica,
 * ela vale para TODOS os clubes, independente do dia da semana
 *
 * Exemplos:
 * - Feriado Nacional em 15/11/2024 (quarta-feira)
 *   → Todos os clubes de quarta NÃO funcionam nesse dia
 *
 * - Evento Especial em 20/08/2024 (terça-feira)
 *   → Todos os clubes de terça NÃO funcionam nesse dia
 *
 * IMPORTANTE: A exceção é por DATA, não por dia da semana.
 * Afeta apenas os clubes que funcionam no dia da semana daquela data.
 */
@Entity('weekday_exceptions')
@Unique('UQ_weekday_exception_date', ['exceptionDate'])
export class ClubExceptionEntity extends BaseEntity {
  @Column({ type: 'date', unique: true })
  exceptionDate: string; // Data da exceção (ex: "2024-11-15")

  @Column({ type: 'varchar', length: 255 })
  reason: string; // Motivo: "Feriado Nacional", "Recesso", "Evento", etc.

  @Column({
    type: 'enum',
    enum: ['holiday', 'event', 'maintenance', 'vacation', 'other'],
    default: 'other',
  })
  type: string;

  @Column({ type: 'text', nullable: true })
  notes?: string | null; // Observações adicionais

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Se a exceção está ativa

  @Column({ type: 'boolean', default: true })
  isRecurrent: boolean; // Se repete todo ano (ex: Natal sempre é exceção)
}
