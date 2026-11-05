import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { FeedPhotoCommentEntity } from './feed-photo-comment.entity';
import {
  PHOTO_COMMENT_MAX_LENGTH,
  PHOTO_COMMENT_REASON_MAX_LENGTH,
} from '../constants';

@Entity('feed_photo_comment_notifications')
@Index('UQ_photo_comment_notice_review', ['commentId', 'commentVersion'], {
  unique: true,
})
@Index('IDX_photo_comment_notice_recipient_read_created', [
  'recipientId',
  'readAt',
  'createdAt',
])
export class PhotoCommentNotificationEntity extends BaseEntity {
  @Column({ type: 'varchar', length: 36 })
  recipientId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'recipientId' })
  recipient: UserEntity;

  @Column({ type: 'varchar', length: 36 })
  commentId: string;

  @ManyToOne(() => FeedPhotoCommentEntity, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({ name: 'commentId' })
  comment: FeedPhotoCommentEntity;

  @Column({ type: 'int' })
  commentVersion: number;

  @Column({ type: 'varchar', length: PHOTO_COMMENT_MAX_LENGTH })
  commentText: string;

  @Column({ type: 'varchar', length: PHOTO_COMMENT_REASON_MAX_LENGTH })
  reason: string;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;
}
