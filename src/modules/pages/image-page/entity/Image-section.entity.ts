import { Entity, Column, ManyToOne } from 'typeorm';
import { ImagePageEntity } from './Image-page.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';

@Entity('image_sections')
export class ImageSectionEntity extends BaseEntity {

  @Column()
  caption: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ default: true })
  public: boolean;

  @ManyToOne(() => ImagePageEntity, (page) => page.sections, { onDelete: 'CASCADE', nullable: true })
  page?: ImagePageEntity | null;
}
