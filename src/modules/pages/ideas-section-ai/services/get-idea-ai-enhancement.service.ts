import { Injectable } from '@nestjs/common';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { IDEA_AI, IDEA_AI_ACTIVE } from '../constants';
import { IdeaAiDetailDto } from '../dto/idea-ai-response.dto';
import { IdeaAiEnhancementStatus } from '../enums/ideas-section-ai.enums';
import { toIdeaAiAttempt } from '../mappers';
import { toIdeasSectionMediaResponse } from '../../ideas-section/mappers';
@Injectable()
export class GetIdeaAiEnhancementService {
  constructor(private readonly repo: IdeasSectionAiRepository) {}
  async summaries(
    ids: string[],
  ): Promise<Map<string, IdeaAiEnhancementStatus>> {
    const rows = await this.repo.attempts(ids);
    const result = new Map<string, IdeaAiEnhancementStatus>();
    for (const row of rows)
      if (!result.has(row.sectionId)) result.set(row.sectionId, row.status);
    return result;
  }
  async get(sectionId: string): Promise<IdeaAiDetailDto> {
    const [snapshot, attempts, choices] = await Promise.all([
      this.repo.snapshot(sectionId),
      this.repo.attempts([sectionId]),
      this.repo.publicationChoices(sectionId),
    ]);
    const medias = await this.repo.mediaResults(attempts.map((a) => a.id));
    const active = attempts.find((a) => IDEA_AI_ACTIVE.includes(a.status));
    const current = attempts.find(
      (a) => a.currentResultSectionId === sectionId,
    );
    return {
      maxAttempts: IDEA_AI.maxAttempts,
      publicationChoices: choices.map(
        ({ field, sourceMediaId, enhancementId, decision }) => ({
          field,
          sourceMediaId,
          enhancementId,
          decision,
        }),
      ),
      snapshot: snapshot
        ? {
            title: snapshot.submittedTitle,
            description: snapshot.submittedDescription,
            submittedAt: snapshot.submittedAt.toISOString(),
            source: snapshot.source,
            medias: snapshot.medias
              .sort((a, b) => a.position - b.position)
              .map((m) => toIdeasSectionMediaResponse(m.sourceMedia)),
          }
        : null,
      activeAttempt: active ? toIdeaAiAttempt(active, medias) : null,
      currentResult: current ? toIdeaAiAttempt(current, medias) : null,
      attemptHistory: attempts.map((a) => toIdeaAiAttempt(a, medias)),
    };
  }
}
