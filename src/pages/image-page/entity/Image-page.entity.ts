import { RouteEntity } from 'src/route/route-page.entity';
import {
  Entity,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ImageSectionEntity } from './Image-section.entity';
import { BaseEntity } from 'src/share/share-entity/base.entity';

@Entity('image_pages')
export class ImagePageEntity extends BaseEntity {

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

  @OneToMany(() => ImageSectionEntity, (section) => section.page, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  sections: ImageSectionEntity[];
}
