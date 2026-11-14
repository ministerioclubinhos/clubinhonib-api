import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { BaseEntity } from 'src/shared/share-entity/base.entity';
import { IdeasSectionEntity } from 'src/modules/pages/ideas-page/entities/ideas-section.entity';
import {
  IdeaAiDecision,
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
  IdeaAiScope,
} from '../enums/ideas-section-ai.enums';
import { IdeasSectionSubmissionSnapshotEntity } from './ideas-section-submission-snapshot.entity';

@Entity('ideas_section_ai_enhancements')
@Unique('uq_idea_ai_attempt_number', ['sectionId', 'attempt'])
@Index('idx_idea_ai_status_lease', ['status', 'leaseExpiresAt'])
@Index('uq_idea_ai_active_section', ['activeSectionId'], { unique: true })
@Index('uq_idea_ai_current_section', ['currentResultSectionId'], {
  unique: true,
})
export class IdeasSectionAiEnhancementEntity extends BaseEntity {
  @Column({ name: 'section_id', type: 'varchar', length: 36 })
  sectionId: string;

  @ManyToOne(() => IdeasSectionEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'section_id',
    foreignKeyConstraintName: 'fk_idea_ai_enhancement_section',
  })
  section: IdeasSectionEntity;

  @Column({ name: 'snapshot_id', type: 'varchar', length: 36 })
  snapshotId: string;

  @ManyToOne(() => IdeasSectionSubmissionSnapshotEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'snapshot_id',
    foreignKeyConstraintName: 'fk_idea_ai_enhancement_snapshot',
  })
  snapshot: IdeasSectionSubmissionSnapshotEntity;

  @Column({
    type: 'enum',
    enum: IdeaAiEnhancementStatus,
    default: IdeaAiEnhancementStatus.PENDING,
  })
  status: IdeaAiEnhancementStatus;

  @Column({ type: 'varchar', length: 32 })
  provider: string;

  @Column({ name: 'text_model', type: 'varchar', length: 128, nullable: true })
  textModel: string | null;

  @Column({ name: 'image_model', type: 'varchar', length: 128, nullable: true })
  imageModel: string | null;

  @Column({ name: 'prompt_version', type: 'varchar', length: 64 })
  promptVersion: string;

  @Column({ type: 'int' })
  attempt: number;

  /** O que esta tentativa refaz; o restante vem de `baseEnhancementId`. */
  @Column({
    type: 'enum',
    enum: IdeaAiScope,
    default: IdeaAiScope.FULL,
  })
  scope: IdeaAiScope;

  /** Título e descrição entram nesta tentativa. */
  @Column({ name: 'include_text', type: 'boolean', default: true })
  includeText: boolean;

  /** Mídias de origem refeitas; null = todas as do snapshot. */
  @Column({ name: 'target_media_ids', type: 'json', nullable: true })
  targetMediaIds: string[] | null;

  /** Resultado vigente no pedido, de onde vêm os itens não refeitos. */
  @Column({
    name: 'base_enhancement_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  baseEnhancementId: string | null;

  /** Orientação da administração para esta tentativa. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  instructions: string | null;

  /** Quantas vezes um worker assumiu a tentativa (inclui retomadas). */
  @Column({ name: 'claim_count', type: 'int', default: 0 })
  claimCount: number;

  @Column({ name: 'progress_total', type: 'int', default: 0 })
  progressTotal: number;

  @Column({ name: 'progress_done', type: 'int', default: 0 })
  progressDone: number;

  /** Null outside PENDING/PROCESSING; a unique section id enforces one active attempt. */
  @Column({
    name: 'active_section_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  activeSectionId: string | null;

  /** Null unless this is the newest completed result available to the reviewer. */
  @Column({
    name: 'current_result_section_id',
    type: 'varchar',
    length: 36,
    nullable: true,
  })
  currentResultSectionId: string | null;

  @Column({ name: 'lease_owner', type: 'varchar', length: 36, nullable: true })
  leaseOwner: string | null;

  @Column({ name: 'lease_expires_at', type: 'datetime', nullable: true })
  leaseExpiresAt: Date | null;

  @Column({ name: 'requested_at', type: 'datetime' })
  requestedAt: Date;

  @Column({ name: 'started_at', type: 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'datetime', nullable: true })
  finishedAt: Date | null;

  @Column({
    name: 'enhanced_title',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  enhancedTitle: string | null;

  @Column({ name: 'enhanced_description', type: 'text', nullable: true })
  enhancedDescription: string | null;

  @Column({
    name: 'title_decision',
    type: 'enum',
    enum: IdeaAiDecision,
    default: IdeaAiDecision.PENDING,
  })
  titleDecision: IdeaAiDecision;

  @Column({
    name: 'description_decision',
    type: 'enum',
    enum: IdeaAiDecision,
    default: IdeaAiDecision.PENDING,
  })
  descriptionDecision: IdeaAiDecision;

  @Column({ name: 'text_guard', type: 'json', nullable: true })
  textGuard: Record<string, unknown> | null;

  @Column({
    name: 'error_code',
    type: 'enum',
    enum: IdeaAiErrorCode,
    nullable: true,
  })
  errorCode: IdeaAiErrorCode | null;
}
