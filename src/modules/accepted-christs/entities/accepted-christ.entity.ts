import { UserEntity } from 'src/core/user/entities/user.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { DecisionType } from '../enums/decision-type.enum';

@Entity('accepted_christs')
export class AcceptedChristEntity extends BaseEntity {
  @Column({
    type: 'enum',
    enum: DecisionType,
    nullable: true,
    default: null,
  })
  decision: DecisionType | null;

  @ManyToOne(() => ChildEntity, (child) => child.acceptedChrists, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'child_id' })
  child: ChildEntity;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes?: string | null;

  /**
   * Quem registrou a decisão. `null` em registros anteriores a esta coluna ou
   * quando o usuário foi excluído depois.
   */
  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy?: UserEntity | null;
}
