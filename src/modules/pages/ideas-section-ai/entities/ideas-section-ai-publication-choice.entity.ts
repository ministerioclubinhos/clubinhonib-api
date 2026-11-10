import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';
import {
  IdeaAiDecision,
  IdeaAiPublicationField,
} from '../enums/ideas-section-ai.enums';
import { IdeasSectionAiEnhancementEntity } from './ideas-section-ai-enhancement.entity';

@Entity('ideas_section_ai_publication_choices')
@Unique('uq_idea_ai_publication_choice', [
  'sectionId',
  'field',
  'sourceMediaId',
])
@Unique('uq_idea_ai_publication_choice_key', ['sectionId', 'choiceKey'])
export class IdeasSectionAiPublicationChoiceEntity extends BaseEntity {
  /** TITLE, DESCRIPTION, or MEDIA:<source UUID>; never nullable in MySQL. */
  @Column({ name: 'choice_key', type: 'varchar', length: 64 })
  choiceKey: string;

  @Column({ name: 'section_id', type: 'varchar', length: 36 })
  sectionId: string;

  @ManyToOne(() => IdeasSectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'section_id',
    foreignKeyConstraintName: 'fk_idea_ai_choice_section',
  })
  section: IdeasSectionEntity;

  @Column({
    name: 'enhancement_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  enhancementId: string | null;

  @ManyToOne(() => IdeasSectionAiEnhancementEntity, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({
    name: 'enhancement_id',
    foreignKeyConstraintName: 'fk_idea_ai_choice_enhancement',
  })
  enhancement: IdeasSectionAiEnhancementEntity | null;

  @Column({ type: 'enum', enum: IdeaAiPublicationField })
  field: IdeaAiPublicationField;

  @Column({
    name: 'source_media_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  sourceMediaId: string | null;

  @ManyToOne(() => MediaItemEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({
    name: 'source_media_id',
    foreignKeyConstraintName: 'fk_idea_ai_choice_media',
  })
  sourceMedia: MediaItemEntity | null;

  @Column({ type: 'enum', enum: IdeaAiDecision })
  decision: IdeaAiDecision;
}
