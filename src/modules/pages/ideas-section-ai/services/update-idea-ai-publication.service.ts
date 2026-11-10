import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  AppBusinessException,
  AppConflictException,
  AppNotFoundException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import {
  MediaItemEntity,
  MediaType,
} from 'src/shared/media/media-item/media-item.entity';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { CreateIdeaSnapshotService } from './create-idea-snapshot.service';
import { UpdateIdeasSectionDto } from '../../ideas-section/dto/update-ideas-section.dto';
import { IdeasSectionMediaItemDto } from '../../ideas-section/dto/ideas-section-media-item.dto';
import { IdeasSectionMediaType } from '../../ideas-section/entities/ideas-section-media-type.enum';
import {
  IdeaAiDecision,
  IdeaAiMediaStatus,
  IdeaAiPublicationField,
} from '../enums/ideas-section-ai.enums';
import { IDEA_AI_ACTIVE } from '../constants';
import { IdeaAiPublicationPreparation } from '../types';
@Injectable()
export class UpdateIdeaAiPublicationService {
  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly snapshots: CreateIdeaSnapshotService,
    private readonly media: MediaItemProcessor,
  ) {}
  async prepare(
    sectionId: string,
    input: UpdateIdeasSectionDto,
    manager: EntityManager,
    publishing: boolean,
  ): Promise<IdeaAiPublicationPreparation> {
    const existing = await this.repo.lockSection(sectionId, manager);
    if (!existing)
      throw new AppNotFoundException(
        ErrorCode.IDEA_NOT_FOUND,
        'Ideia não encontrada.',
      );
    if (publishing && existing.page)
      throw new AppBusinessException(
        ErrorCode.SECTION_UPDATE_ERROR,
        'Esta ideia já foi publicada em uma página.',
      );
    const existingMedia = await this.media.findMediaItemsByTargetInTransaction(
      manager,
      sectionId,
      MediaTargetType.IdeasSection,
    );
    const snapshot = await this.snapshots.capture(
      existing,
      existingMedia,
      manager,
    );
    const history = await this.repo.attempts([sectionId], manager);
    const active = history.some((a) => IDEA_AI_ACTIVE.includes(a.status));
    const originalOnly =
      publishing && active && input.ignoreAiEnhancement === true;
    if (publishing && active && !originalOnly)
      throw new AppConflictException(
        ErrorCode.IDEA_AI_ENHANCEMENT_IN_PROGRESS,
        'A IA ainda está trabalhando. Confirme a publicação com o original para continuar.',
      );
    if (originalOnly) await this.repo.cancel(sectionId, manager);
    const decisions = originalOnly ? undefined : input.aiDecisions;
    if (!originalOnly && !decisions) return { dto: input, existingMedia };
    const current = history.find((a) => a.currentResultSectionId === sectionId);
    if (decisions && (!current || decisions.enhancementId !== current.id))
      throw new AppConflictException(
        ErrorCode.IDEA_AI_STALE_DECISIONS,
        'A melhoria mudou. Atualize a revisão e confirme suas escolhas novamente.',
      );
    const results = await this.repo.mediaResults(
      history.map((a) => a.id),
      manager,
    );
    const titleDecision = decisions?.title ?? IdeaAiDecision.ORIGINAL;
    const descriptionDecision =
      decisions?.description ?? IdeaAiDecision.ORIGINAL;
    if (
      (titleDecision === IdeaAiDecision.ENHANCED && !current?.enhancedTitle) ||
      (descriptionDecision === IdeaAiDecision.ENHANCED &&
        current?.enhancedDescription == null)
    ) {
      throw new AppValidationException(
        ErrorCode.VALIDATION_ERROR,
        'Este texto não possui melhoria aprovada.',
      );
    }
    const mediaDecisions =
      decisions?.medias ??
      snapshot.medias.map((m) => ({
        sourceMediaId: m.sourceMediaId,
        decision: IdeaAiDecision.ORIGINAL,
      }));
    const sourceUrls = new Set([
      ...snapshot.medias.map((m) => m.url),
      ...results.map((r) => r.enhancedMedia?.url),
    ]);
    const selected: IdeasSectionMediaItemDto[] = originalOnly
      ? []
      : input.medias.filter(
          (m) => !sourceUrls.has(m.url) || Boolean(m.fieldKey),
        );
    for (const choice of mediaDecisions) {
      const original = snapshot.medias.find(
        (m) => m.sourceMediaId === choice.sourceMediaId,
      )?.sourceMedia;
      const enhanced = results.find(
        (m) =>
          m.enhancementId === current?.id &&
          m.sourceMediaId === choice.sourceMediaId &&
          m.status === IdeaAiMediaStatus.ENHANCED,
      )?.enhancedMedia;
      const chosen =
        choice.decision === IdeaAiDecision.ENHANCED ? enhanced : original;
      if (!original || !chosen)
        throw new AppValidationException(
          ErrorCode.VALIDATION_ERROR,
          'Uma mídia escolhida não possui versão disponível nesta tentativa.',
        );
      let projection = existingMedia.find(
        (m) => m.url === chosen.url && m.mediaType === chosen.mediaType,
      );
      if (!projection) {
        projection = await this.media.saveMediaItemInTransaction(manager, {
          title: chosen.title,
          description: chosen.description,
          mediaType: chosen.mediaType,
          uploadType: chosen.uploadType,
          platformType: chosen.platformType,
          url: chosen.url,
          isLocalFile: chosen.isLocalFile,
          originalName: chosen.originalName,
          size: chosen.size,
          targetId: sectionId,
          targetType: MediaTargetType.IdeasSection,
        });
        existingMedia.push(projection);
      }
      selected.push(this.toInput(projection));
    }
    const enhancementId = current?.id ?? null;
    await this.repo.replaceChoices(
      sectionId,
      [
        {
          sectionId,
          choiceKey: IdeaAiPublicationField.TITLE,
          field: IdeaAiPublicationField.TITLE,
          decision: titleDecision,
          enhancementId,
        },
        {
          sectionId,
          choiceKey: IdeaAiPublicationField.DESCRIPTION,
          field: IdeaAiPublicationField.DESCRIPTION,
          decision: descriptionDecision,
          enhancementId,
        },
        ...mediaDecisions.map((c) => ({
          sectionId,
          choiceKey: `${IdeaAiPublicationField.MEDIA}:${c.sourceMediaId}`,
          field: IdeaAiPublicationField.MEDIA,
          ...c,
          enhancementId,
        })),
      ],
      manager,
    );
    if (current && decisions) {
      await this.repo.saveAttempt(
        { id: current.id, titleDecision, descriptionDecision },
        manager,
      );
      for (const choice of mediaDecisions) {
        const result = results.find(
          (r) =>
            r.enhancementId === current.id &&
            r.sourceMediaId === choice.sourceMediaId,
        );
        if (result)
          await this.repo.saveMediaResult(
            { id: result.id, decision: choice.decision },
            manager,
          );
      }
    }
    return {
      existingMedia,
      dto: {
        ...input,
        medias: selected,
        title:
          titleDecision === IdeaAiDecision.ENHANCED
            ? current!.enhancedTitle!
            : snapshot.submittedTitle,
        description:
          descriptionDecision === IdeaAiDecision.ENHANCED
            ? current!.enhancedDescription!
            : snapshot.submittedDescription,
      },
    };
  }
  private toInput(media: MediaItemEntity): IdeasSectionMediaItemDto {
    return {
      id: media.id,
      title: media.title,
      description: media.description,
      url: media.url,
      uploadType: media.uploadType,
      platformType: media.platformType,
      originalName: media.originalName,
      size: media.size,
      isLocalFile: media.isLocalFile,
      mediaType:
        media.mediaType === MediaType.DOCUMENT
          ? IdeasSectionMediaType.DOCUMENT
          : media.mediaType === MediaType.IMAGE
            ? IdeasSectionMediaType.IMAGE
            : IdeasSectionMediaType.VIDEO,
    };
  }
}
