import { IdeasSectionMediaResponseDto } from '../../ideas-section/dto/ideas-section-response.dto';
import {
  IdeaAiDecision,
  IdeaAiPublicationField,
  IdeaAiEnhancementStatus,
  IdeaAiErrorCode,
  IdeaAiMediaStatus,
  IdeaAiSkipReason,
  IdeaSubmissionSnapshotSource,
} from '../enums/ideas-section-ai.enums';
import { IdeaAiGuard } from '../types';
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
}
export class IdeaAiAttemptDto {
  id: string;
  attempt: number;
  status: IdeaAiEnhancementStatus;
  requestedAt: string;
  finishedAt: string | null;
  errorCode: IdeaAiErrorCode | null;
  enhancedTitle: string | null;
  enhancedDescription: string | null;
  textGuard: IdeaAiGuard | null;
  titleDecision: IdeaAiDecision;
  descriptionDecision: IdeaAiDecision;
  medias: IdeaAiMediaResultDto[];
}
export class IdeaAiPublicationChoiceDto {
  field: IdeaAiPublicationField;
  sourceMediaId: string | null;
  enhancementId: string | null;
  decision: IdeaAiDecision;
}
export class IdeaAiDetailDto {
  publicationChoices: IdeaAiPublicationChoiceDto[];
  snapshot: IdeaAiSnapshotDto | null;
  activeAttempt: IdeaAiAttemptDto | null;
  currentResult: IdeaAiAttemptDto | null;
  attemptHistory: IdeaAiAttemptDto[];
  maxAttempts: number;
}
export class IdeaAiQueuedDto {
  id: string;
  attempt: number;
  status: IdeaAiEnhancementStatus;
}
