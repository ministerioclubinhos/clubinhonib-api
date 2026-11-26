import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';

/** Lista "Assistir depois" de cada professor. */
@Entity('play_favorites')
@Unique('UQ_play_favorites_user_media', ['userId', 'mediaItemId'])
export class PlayFavoriteEntity extends BaseEntity {
  @Column({ name: 'media_item_id', type: 'varchar', length: 36 })
  mediaItemId: string;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'media_item_id' })
  mediaItem?: MediaItemEntity;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;
}
