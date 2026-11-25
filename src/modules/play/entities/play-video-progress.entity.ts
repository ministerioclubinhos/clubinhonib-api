import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';

/** Onde cada professor parou em cada vídeo (dado pessoal: só o próprio lê). */
@Entity('play_video_progress')
@Unique('UQ_play_video_progress_user_media', ['userId', 'mediaItemId'])
export class PlayVideoProgressEntity extends BaseEntity {
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

  @Column({ name: 'position_seconds', type: 'int', default: 0 })
  positionSeconds: number;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'boolean', default: false })
  completed: boolean;
}
