import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  VersionColumn,
} from 'typeorm';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { PhotoCommentStatus } from '../types';
import {
  PHOTO_COMMENT_MAX_LENGTH,
  PHOTO_COMMENT_REASON_MAX_LENGTH,
} from '../constants';

@Entity('feed_photo_comments')
@Index('IDX_feed_photo_comments_media_status_created', [
  'mediaId',
  'status',
  'createdAt',
])
@Index('IDX_feed_photo_comments_status_created', ['status', 'createdAt'])
@Index('IDX_feed_photo_comments_author_created', ['authorId', 'createdAt'])
@Index('UQ_feed_photo_comments_author_request', ['authorId', 'requestId'], {
  unique: true,
})
export class FeedPhotoCommentEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  mediaId: string;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'mediaId' })
  media: MediaItemEntity;

  @Column({ type: 'varchar', length: 36 })
  authorId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'authorId' })
  author: UserEntity;

  @Column({ type: 'varchar', length: 36 })
  requestId: string;

  @Column({ type: 'varchar', length: PHOTO_COMMENT_MAX_LENGTH })
  text: string;

  @Column({
    type: 'enum',
    enum: PhotoCommentStatus,
    default: PhotoCommentStatus.PENDING,
  })
  status: PhotoCommentStatus;

  @Column({
    type: 'varchar',
    length: PHOTO_COMMENT_REASON_MAX_LENGTH,
    nullable: true,
  })
  moderationReason: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true })
  moderatedById: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'moderatedById' })
  moderatedBy: UserEntity | null;

  @Column({ type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  @VersionColumn()
  version: number;
}
