import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import {
  MediaItemEntity,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';

/** Vídeo enviado por um usuário, aguardando (ou já com) a decisão do admin. */
@Entity('play_submissions')
@Index('IDX_play_submissions_status', ['status', 'createdAt'])
export class PlaySubmissionEntity extends BaseEntity {
  @Column({
    name: 'submitted_by_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  submittedById: string | null;

  /** `SET NULL`: apagar a pessoa não apaga o histórico da moderação. */
  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'submitted_by_id' })
  submittedBy?: UserEntity | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'upload_type', type: 'enum', enum: UploadType })
  uploadType: UploadType;

  @Column({
    name: 'platform_type',
    type: 'enum',
    enum: PlatformType,
    nullable: true,
  })
  platformType: PlatformType | null;

  @Column({ type: 'varchar', length: 1000 })
  url: string;

  @Column({
    name: 'original_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  originalName: string | null;

  @Column({
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (v: number | null) => v,
      from: (v: string | null) => (v === null ? null : Number(v)),
    },
  })
  size: number | null;

  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  thumbnailUrl: string | null;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({
    type: 'enum',
    enum: PlaySubmissionStatus,
    default: PlaySubmissionStatus.PENDING,
  })
  status: PlaySubmissionStatus;

  @Column({
    name: 'rejection_reason',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  rejectionReason: string | null;

  @Column({
    name: 'reviewed_by_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  reviewedById: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy?: UserEntity | null;

  @Column({ name: 'reviewed_at', type: 'datetime', nullable: true })
  reviewedAt: Date | null;

  /** Vídeo criado na galeria quando aprovado. */
  @Column({
    name: 'media_item_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  mediaItemId: string | null;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'media_item_id' })
  mediaItem?: MediaItemEntity | null;
}
