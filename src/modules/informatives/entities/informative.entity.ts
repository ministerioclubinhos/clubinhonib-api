import { BaseEntity } from 'src/shared/share-entity/base.entity';
import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { RouteEntity } from 'src/modules/routes/route-page.entity';

@Entity('informatives')
export class InformativeEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'boolean', default: true })
  public: boolean;

  @OneToOne(() => RouteEntity, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: RouteEntity | null;
}
