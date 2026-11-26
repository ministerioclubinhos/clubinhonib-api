import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { VideosPage } from 'src/modules/pages/video-page/entities/video-page.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

/**
 * Atributos de um vídeo dentro do Clubinho Play (destaque e posição).
 *
 * Existe uma linha por vídeo marcado (escopo `selected`) ou por vídeo da
 * galeria (escopo `all`). Quem decide se o vídeo aparece é o escopo da
 * galeria; a linha só guarda o que é próprio do vídeo.
 */
@Entity('play_video_entries')
@Unique('UQ_play_video_entries_media_item', ['mediaItemId'])
export class PlayVideoEntryEntity extends BaseEntity {
  @Column({ name: 'videos_page_id', type: 'varchar', length: 36 })
  videosPageId: string;

  @ManyToOne(() => VideosPage, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'videos_page_id' })
  videosPage?: VideosPage;

  @Column({ name: 'media_item_id', type: 'varchar', length: 36 })
  mediaItemId: string;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'media_item_id' })
  mediaItem?: MediaItemEntity;

  @Column({ type: 'boolean', default: false })
  featured: boolean;

  @Column({ type: 'int', nullable: true })
  position: number | null;

  /** Miniatura enviada pelo admin (S3). Sem ela, o YouTube deriva a própria. */
  @Column({
    name: 'thumbnail_url',
    type: 'varchar',
    length: 1000,
    nullable: true,
  })
  thumbnailUrl: string | null;

  /** Duração lida no navegador do admin (só uploads). */
  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;
}
