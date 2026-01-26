import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { RouteEntity } from 'src/modules/routes/route-page.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

@Entity('videos_pages')
export class VideosPage extends BaseEntity {
  @Column()
  name: string;

  @Column()
  public: boolean;

  @Column({ type: 'text' })
  description: string;

  @OneToOne(() => RouteEntity, {
    cascade: true,
    eager: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  route: RouteEntity;
}
