import { Injectable } from '@nestjs/common';
import {
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { CreateIdeaSnapshotService } from './create-idea-snapshot.service';
import { IDEA_AI, IDEA_AI_ACTIVE } from '../constants';
import { IdeaAiEnhancementStatus } from '../enums/ideas-section-ai.enums';
import { IdeaAiQueuedDto } from '../dto/idea-ai-response.dto';
@Injectable()
export class CreateIdeaAiEnhancementService {
  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly snapshots: CreateIdeaSnapshotService,
    private readonly media: MediaItemProcessor,
    private readonly settings: GetAiProviderSettingsService,
    private readonly flags: GetFeatureFlagsService,
  ) {}
  async enqueueAutomatic(sectionId: string): Promise<void> {
    if (
      await this.flags.isSwitchedOn(FeatureFlagKeys.IDEA_AI_ENHANCEMENT, false)
    )
      await this.create(sectionId, true);
  }
  async create(sectionId: string, automatic = false): Promise<IdeaAiQueuedDto> {
    const settings = await this.settings.getInternalSettings();
    const configured = settings[settings.llmProvider];
    return this.repo.transaction(async (manager) => {
      const section = await this.repo.lockSection(sectionId, manager);
      if (!section)
        throw new AppNotFoundException(
          ErrorCode.IDEA_NOT_FOUND,
          'Ideia não encontrada.',
        );
      if (automatic && section.page)
        throw new AppConflictException(
          ErrorCode.SECTION_UPDATE_ERROR,
          'A ideia já foi publicada; a melhoria automática não será iniciada.',
        );
      const history = await this.repo.attempts([sectionId], manager);
      if (history.some((a) => IDEA_AI_ACTIVE.includes(a.status)))
        throw new AppConflictException(
          ErrorCode.IDEA_AI_ENHANCEMENT_IN_PROGRESS,
          'A IA já está melhorando esta ideia. Aguarde a conclusão.',
        );
      if (history.length >= IDEA_AI.maxAttempts)
        throw new AppConflictException(
          ErrorCode.IDEA_AI_ATTEMPT_LIMIT,
          'Esta ideia atingiu o limite de 3 tentativas. O original continua disponível.',
        );
      const medias = await this.media.findMediaItemsByTargetInTransaction(
        manager,
        sectionId,
        MediaTargetType.IdeasSection,
      );
      const snapshot = await this.snapshots.capture(section, medias, manager);
      const attempt = await this.repo.saveAttempt(
        {
          sectionId,
          snapshotId: snapshot.id,
          attempt: (history[0]?.attempt ?? 0) + 1,
          activeSectionId: sectionId,
          currentResultSectionId: null,
          status: IdeaAiEnhancementStatus.PENDING,
          provider: settings.llmProvider,
          textModel: configured.generalModel,
          imageModel: configured.imageModel,
          promptVersion: IDEA_AI.promptVersion,
          requestedAt: new Date(),
        },
        manager,
      );
      return {
        id: attempt.id,
        attempt: attempt.attempt,
        status: attempt.status,
      };
    });
  }
}
