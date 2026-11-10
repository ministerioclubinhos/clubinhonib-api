import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import {
  IdeaAiDecision,
  IdeaAiMediaKind,
  IdeaAiMediaStatus,
  IdeaAiSkipReason,
} from '../enums/ideas-section-ai.enums';
import { IdeasSectionAiEnhancementEntity } from './ideas-section-ai-enhancement.entity';

@Entity('ideas_section_ai_media_enhancements')
@Unique('uq_idea_ai_media_source', ['enhancementId', 'sourceMediaId'])
export class IdeasSectionAiMediaEnhancementEntity extends BaseEntity {
  @Column({ name: 'enhancement_id', type: 'varchar', length: 36 })
  enhancementId: string;

  @ManyToOne(() => IdeasSectionAiEnhancementEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'enhancement_id',
    foreignKeyConstraintName: 'fk_idea_ai_media_enhancement',
  })
  enhancement: IdeasSectionAiEnhancementEntity;

  @Column({ name: 'source_media_id', type: 'varchar', length: 36 })
  sourceMediaId: string;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'source_media_id',
    foreignKeyConstraintName: 'fk_idea_ai_media_source',
  })
  sourceMedia: MediaItemEntity;

  @Column({
    name: 'enhanced_media_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  enhancedMediaId: string | null;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'enhanced_media_id',
    foreignKeyConstraintName: 'fk_idea_ai_media_result',
  })
  enhancedMedia: MediaItemEntity | null;

  @Column({
    name: 'editable_media_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  editableMediaId: string | null;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'editable_media_id',
    foreignKeyConstraintName: 'fk_idea_ai_media_editable',
  })
  editableMedia: MediaItemEntity | null;

  @Column({ type: 'enum', enum: IdeaAiMediaKind })
  kind: IdeaAiMediaKind;

  @Column({
    type: 'enum',
    enum: IdeaAiMediaStatus,
    default: IdeaAiMediaStatus.PENDING,
  })
  status: IdeaAiMediaStatus;

  @Column({
    name: 'skip_reason',
    type: 'enum',
    enum: IdeaAiSkipReason,
    nullable: true,
  })
  skipReason: IdeaAiSkipReason | null;

  @Column({ type: 'json', nullable: true })
  guard: Record<string, unknown> | null;

  @Column({
    type: 'enum',
    enum: IdeaAiDecision,
    default: IdeaAiDecision.PENDING,
  })
  decision: IdeaAiDecision;
}
