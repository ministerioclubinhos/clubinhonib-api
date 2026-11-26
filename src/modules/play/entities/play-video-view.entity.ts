import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';

/** Uma visualização de um vídeo do Play por um professor. */
@Entity('play_video_views')
@Index('IDX_play_video_views_media_item', ['mediaItemId'])
export class PlayVideoViewEntity extends BaseEntity {
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
