import { toIdeasSectionMediaResponse } from '../ideas-section/mappers';
import { IdeaAiAttemptDto } from './dto/idea-ai-response.dto';
import { IdeasSectionAiEnhancementEntity } from './entities/ideas-section-ai-enhancement.entity';
import { IdeasSectionAiMediaEnhancementEntity } from './entities/ideas-section-ai-media-enhancement.entity';
import { IdeaAiGuard, IdeaAiTextGuard } from './types';
import { countsTowardIdeaAiLimit } from './utils';
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
export function toIdeaAiTextGuard(
  value: Record<string, unknown> | null,
): IdeaAiTextGuard | null {
  const guard = toIdeaAiGuard(value);
  if (!guard || !value) return guard;
  const fields = value.fields;
  if (typeof fields !== 'object' || fields === null) return guard;
  const record = fields as Record<string, unknown>;
  const asGuard = (field: unknown) =>
    typeof field === 'object' && field !== null
      ? toIdeaAiGuard(field as Record<string, unknown>)
      : null;
  const title = asGuard(record.title);
  const description = asGuard(record.description);
  return title && description
    ? { ...guard, fields: { title, description } }
    : guard;
}
export function toIdeaAiAttempt(
  a: IdeasSectionAiEnhancementEntity,
  medias: IdeasSectionAiMediaEnhancementEntity[],
  attempts: IdeasSectionAiEnhancementEntity[] = [],
): IdeaAiAttemptDto {
  return {
    id: a.id,
    attempt: a.attempt,
    status: a.status,
    requestedAt: a.requestedAt.toISOString(),
    startedAt: a.startedAt?.toISOString() ?? null,
    finishedAt: a.finishedAt?.toISOString() ?? null,
    errorCode: a.errorCode,
    scope: a.scope,
    includeText: a.includeText,
    targetMediaIds: a.targetMediaIds,
    baseAttempt:
      attempts.find((other) => other.id === a.baseEnhancementId)?.attempt ??
      null,
    instructions: a.instructions,
    progressDone: a.progressDone,
    progressTotal: a.progressTotal,
    countsTowardLimit: countsTowardIdeaAiLimit(a),
    enhancedTitle: a.enhancedTitle,
    enhancedDescription: a.enhancedDescription,
    textGuard: toIdeaAiTextGuard(a.textGuard),
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
        errorCode: m.errorCode,
        carriedOver: m.carriedOver,
      })),
  };
}
