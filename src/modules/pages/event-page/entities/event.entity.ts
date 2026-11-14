import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity';
import { Weekday } from 'src/modules/clubs/entities/weekday.enum';

export enum EventAudience {
  ALL = 'all',
  TEACHERS = 'teachers',
  COORDINATORS = 'coordinators',
}

export enum EventType {
  VISIT = 'visit',
  MEETING = 'meeting',
  CUSTOM = 'custom',
}

@Entity('events')
export class EventEntity extends BaseEntity {
  @Column()
  title: string;

  @Column()
  date: string;

  @Column()
  location: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'enum', enum: EventAudience, default: EventAudience.ALL })
  audience: EventAudience;

  @Column({
    type: 'enum',
    enum: EventType,
    nullable: true,
    default: EventType.CUSTOM,
  })
  eventType?: EventType;
  /**
   * Um evento não público só aparece para quem está autenticado. Os encontros
   * de clubinho entram assim: dia, horário e endereço não vão para o site
   * aberto.
   */
  @Column({ type: 'boolean', default: true })
  public: boolean;

  /**
   * Encontro que se repete toda semana. `date` guarda a primeira ocorrência;
   * quem exibe o calendário repete `weekday` e `time` nas semanas seguintes.
   */
  @Column({ type: 'boolean', default: false })
  isRecurring: boolean;

  @Column({ type: 'enum', enum: Weekday, nullable: true })
  weekday?: Weekday | null;

  /** Horário no formato `HH:mm`. */
  @Column({
    name: 'time',
    type: 'time',
    nullable: true,
    transformer: {
      to: (v?: string | null) => (v ? (v.length === 5 ? `${v}:00` : v) : v),
      from: (v?: string | null) => (typeof v === 'string' ? v.slice(0, 5) : v),
    },
  })
  time?: string | null;

  /**
   * Clubinho que originou o evento. Preenchido só nos encontros semanais, que
   * são criados e mantidos pela sincronização — não pelo formulário.
   *
   * `CASCADE`: os dias de um clubinho não existem sem ele. Desativar já apaga
   * a linha pela sincronização; a cascata é a rede de segurança para o caso de
   * o clubinho sumir por outro caminho.
   */
  @ManyToOne(() => ClubEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'club_id' })
  club?: ClubEntity | null;

  /**
   * Único de propósito: um clubinho tem no máximo um encontro no calendário, e
   * é o banco que impõe isso. Uma segunda linha para o mesmo clubinho passa a
   * ser impossível — nem por corrida entre instâncias, nem por reprocessamento
   * da rotina de reconciliação. Em MySQL a unicidade ignora `NULL`, então os
   * encontros já encerrados, que perdem o vínculo quando o clubinho é excluído,
   * convivem sem conflito.
   */
  @Column({ name: 'club_id', type: 'varchar', nullable: true, unique: true })
  clubId?: string | null;
}
