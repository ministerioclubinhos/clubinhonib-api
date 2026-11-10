import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import { LessonLlmProvider } from 'src/modules/ai-lessons/providers/lesson-llm.types';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionEntity } from '../../ideas-page/entities/ideas-section.entity';
import { IdeasSectionSubmissionSnapshotEntity } from '../entities/ideas-section-submission-snapshot.entity';
import { IdeasSectionAiEnhancementEntity } from '../entities/ideas-section-ai-enhancement.entity';
import {
  IdeaAiDecision,
  IdeaAiEnhancementStatus,
  IdeaSubmissionSnapshotSource,
} from '../enums/ideas-section-ai.enums';
export const settings: InternalAiProviderSettings = {
  llmProvider: LessonLlmProvider.OPENAI,
  openai: {
    apiKey: 'test-key',
    generalModel: 'configured-text',
    imageModel: 'configured-image',
    reasoningEffort: '',
    imageQuality: 'high',
  },
  gemini: {
    apiKey: 'test-key',
    generalModel: 'configured-gemini',
    imageModel: 'configured-gemini-image',
    fallbackModel: '',
    imageSize: '1K',
    maxRetries: 1,
    retryBaseDelayMs: 1,
  },
};
export const source: MediaItemEntity = Object.assign(new MediaItemEntity(), {
  id: 'source',
  title: 'Documento 1',
  description: '',
  url: 'https://bucket/original.pdf',
  originalName: 'original.pdf',
  mediaType: MediaType.DOCUMENT,
  uploadType: UploadType.UPLOAD,
  isLocalFile: true,
  size: 100,
});
export const section: IdeasSectionEntity = Object.assign(
  new IdeasSectionEntity(),
  {
    id: 'section',
    title: 'Gincana',
    description: 'Separe 3 bolas. João 3:16.',
    createdAt: new Date('2026-01-01'),
    page: null,
  },
);
export const snapshot: IdeasSectionSubmissionSnapshotEntity = Object.assign(
  new IdeasSectionSubmissionSnapshotEntity(),
  {
    id: 'snapshot',
    sectionId: section.id,
    submittedTitle: section.title,
    submittedDescription: section.description,
    submittedAt: section.createdAt,
    source: IdeaSubmissionSnapshotSource.SUBMISSION,
    medias: [
      {
        sourceMediaId: source.id,
        sourceMedia: source,
        url: source.url,
        position: 0,
      },
    ],
  },
);
export const attempt: IdeasSectionAiEnhancementEntity = Object.assign(
  new IdeasSectionAiEnhancementEntity(),
  {
    id: 'attempt',
    sectionId: section.id,
    snapshotId: snapshot.id,
    attempt: 1,
    provider: LessonLlmProvider.OPENAI,
    textModel: 'configured-text',
    imageModel: 'configured-image',
    status: IdeaAiEnhancementStatus.PROCESSING,
    requestedAt: new Date('2026-01-01'),
    finishedAt: null,
    errorCode: null,
    enhancedTitle: null,
    enhancedDescription: null,
    titleDecision: IdeaAiDecision.PENDING,
    descriptionDecision: IdeaAiDecision.PENDING,
    textGuard: null,
    currentResultSectionId: null,
  },
);
