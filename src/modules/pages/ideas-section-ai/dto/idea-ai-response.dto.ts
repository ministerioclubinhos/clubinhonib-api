import { IdeasSectionMediaResponseDto } from '../../ideas-section/dto/ideas-section-response.dto';
import {
  IdeaAiDecision,
  IdeaAiPublicationField,
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
  IdeaAiMediaStatus,
  IdeaAiScope,
  IdeaAiSkipReason,
  IdeaSubmissionSnapshotSource,
} from '../enums/ideas-section-ai.enums';
import { IdeaAiGuard, IdeaAiTextGuard } from '../types';
export class IdeaAiSnapshotDto {
  title: string;
  description: string;
  submittedAt: string;
  source: IdeaSubmissionSnapshotSource;
  medias: IdeasSectionMediaResponseDto[];
}
export class IdeaAiMediaResultDto {
  sourceMediaId: string;
  status: IdeaAiMediaStatus;
  skipReason: IdeaAiSkipReason | null;
  guard: IdeaAiGuard | null;
  decision: IdeaAiDecision;
  enhancedMedia: IdeasSectionMediaResponseDto | null;
  editableMedia: IdeasSectionMediaResponseDto | null;
  /** Falha técnica deste material (também quando a versão anterior foi mantida). */
  errorCode: IdeaAiErrorCode | null;
  /** Veio da tentativa base, sem nova chamada à IA. */
  carriedOver: boolean;
}
export class IdeaAiAttemptDto {
  id: string;
  attempt: number;
  status: IdeaAiEnhancementStatus;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: IdeaAiErrorCode | null;
  scope: IdeaAiScope;
  includeText: boolean;
  /** null = todas as mídias do snapshot. */
  targetMediaIds: string[] | null;
  /** Número da tentativa de onde vieram os itens não refeitos. */
  baseAttempt: number | null;
  instructions: string | null;
  progressDone: number;
  progressTotal: number;
  /** Cancelamentos e falhas de infraestrutura não consomem tentativa. */
  countsTowardLimit: boolean;
  enhancedTitle: string | null;
  enhancedDescription: string | null;
  textGuard: IdeaAiTextGuard | null;
  titleDecision: IdeaAiDecision;
  descriptionDecision: IdeaAiDecision;
  medias: IdeaAiMediaResultDto[];
}
export class IdeaAiPublicationChoiceDto {
  field: IdeaAiPublicationField;
  sourceMediaId: string | null;
  enhancementId: string | null;
  decision: IdeaAiDecision;
  /** A administração editou o texto da versão escolhida. */
  edited: boolean;
}
export class IdeaAiDetailDto {
  publicationChoices: IdeaAiPublicationChoiceDto[];
  snapshot: IdeaAiSnapshotDto | null;
  activeAttempt: IdeaAiAttemptDto | null;
  currentResult: IdeaAiAttemptDto | null;
  attemptHistory: IdeaAiAttemptDto[];
  maxAttempts: number;
  /** Tentativas que contam para o limite. */
  attemptsUsed: number;
  /** Provedor, chave e modelo de texto configurados. */
  providerReady: boolean;
  /** Flag `idea_ai_enhancement`: desligada, nada vai à IA. */
  enabled: boolean;
}
export class IdeaAiQueuedDto {
  id: string;
  attempt: number;
  status: IdeaAiEnhancementStatus;
}
