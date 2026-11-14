import { Entity, Index, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { ImageSectionEntity } from './Image-section.entity';

@Entity('image_section_celebrations')
@Index(['section', 'user'], { unique: true })
export class ImageSectionCelebrationEntity extends BaseEntity {
  @ManyToOne(() => ImageSectionEntity, { onDelete: 'CASCADE' })
  section: ImageSectionEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  user: UserEntity;
}
