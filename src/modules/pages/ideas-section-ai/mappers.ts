import { toIdeasSectionMediaResponse } from '../ideas-section/mappers';
import { IdeaAiAttemptDto } from './dto/idea-ai-response.dto';
import { IdeasSectionAiEnhancementEntity } from './entities/ideas-section-ai-enhancement.entity';
import { IdeasSectionAiMediaEnhancementEntity } from './entities/ideas-section-ai-media-enhancement.entity';
import { IdeaAiGuard } from './types';
export function toIdeaAiGuard(
  value: Record<string, unknown> | null,
): IdeaAiGuard | null {
  return value &&
    typeof value.approved === 'boolean' &&
    Array.isArray(value.violations)
    ? {
        approved: value.approved,
        violations: value.violations.filter(
          (v): v is string => typeof v === 'string',
        ),
      }
    : null;
}
export function toIdeaAiAttempt(
  a: IdeasSectionAiEnhancementEntity,
  medias: IdeasSectionAiMediaEnhancementEntity[],
): IdeaAiAttemptDto {
  return {
    id: a.id,
    attempt: a.attempt,
    status: a.status,
    requestedAt: a.requestedAt.toISOString(),
    finishedAt: a.finishedAt?.toISOString() ?? null,
    errorCode: a.errorCode,
    enhancedTitle: a.enhancedTitle,
    enhancedDescription: a.enhancedDescription,
    textGuard: toIdeaAiGuard(a.textGuard),
    titleDecision: a.titleDecision,
    descriptionDecision: a.descriptionDecision,
    medias: medias
      .filter((m) => m.enhancementId === a.id)
      .map((m) => ({
        sourceMediaId: m.sourceMediaId,
        status: m.status,
        skipReason: m.skipReason,
        guard: toIdeaAiGuard(m.guard),
        decision: m.decision,
        enhancedMedia: m.enhancedMedia
          ? toIdeasSectionMediaResponse(m.enhancedMedia)
          : null,
        editableMedia: m.editableMedia
          ? toIdeasSectionMediaResponse(m.editableMedia)
          : null,
      })),
  };
}
