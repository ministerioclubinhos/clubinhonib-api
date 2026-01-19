import { RouteEntity } from 'src/modules/routes/route-page.entity';
import {
  Entity,
  Column,
  OneToMany,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ImageSectionEntity } from './Image-section.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

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
