import { BaseEntity } from 'src/share/share-entity/base.entity';
import { Entity, Column } from 'typeorm';

export enum RouteType {
  PAGE = 'page',
  DOC = 'doc',
  IMAGE = 'image',  
  OTHER = 'other',
}

@Entity('routes')
export class RouteEntity extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  subtitle: string;

  @Column({ default: true })
  public: boolean;

  @Column({ default: false })
  current?: boolean;
  
  @Column({ type: 'varchar', nullable: true })
  image: string;

  @Column()
  idToFetch: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  path: string;

  @Column({ type: 'varchar', length: 100 })
  entityType: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({ type: 'enum', enum: RouteType })
  type: RouteType;
}
