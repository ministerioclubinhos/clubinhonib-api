import { Injectable } from '@nestjs/common';
import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { IdeaEssenceGuardService } from './idea-essence-guard.service';
import { EnhancedIdeaTextDto } from '../dto/enhanced-idea.dto';
import { IDEA_TEXT_SCHEMA } from '../schemas';
import { IdeaAiTextResult } from '../types';
import {
  checkIdeaTextField,
  combineIdeaTextGuard,
  withAdminInstructions,
} from '../utils';
import { IDEA_AI, IDEA_AI_TEXT_INSTRUCTIONS } from '../constants';
import {
  IDEAS_SECTION_DESCRIPTION_MAX_LENGTH,
  IDEAS_SECTION_TITLE_MAX_LENGTH,
} from '../../ideas-section/constants';

@Injectable()
export class EnhanceIdeaTextService {
  constructor(
    private readonly gateway: IdeaAiGatewayProvider,
    private readonly guard: IdeaEssenceGuardService,
  ) {}

  /**
   * Rewrites title and description, then guards each field on its own: a
   * rejected description no longer throws away a good title. The LLM judge
   * runs once over whatever passed the deterministic checks.
   */
  async enhance(
    settings: InternalAiProviderSettings,
    title: string,
    description: string,
    instructions: string | null = null,
  ): Promise<IdeaAiTextResult> {
    const result = await this.gateway.json(
      settings,
      {
        schema: IDEA_TEXT_SCHEMA,
        instructions: withAdminInstructions(
          IDEA_AI_TEXT_INSTRUCTIONS,
          instructions,
        ),
        data: { title, description },
      },
      EnhancedIdeaTextDto,
    );
    const titleGuard = checkIdeaTextField(
      title,
      result.title,
      IDEAS_SECTION_TITLE_MAX_LENGTH,
      IDEA_AI.minTitlePreservation,
    );
    const descriptionGuard = checkIdeaTextField(
      description,
      result.description,
      IDEAS_SECTION_DESCRIPTION_MAX_LENGTH,
    );
    let judged = { approved: true, violations: [] as string[] };
    if (titleGuard.approved || descriptionGuard.approved)
      judged = await this.guard.verify(
        settings,
        `${title}\n${description}`,
        `${titleGuard.approved ? result.title : title}\n${
          descriptionGuard.approved ? result.description : description
        }`,
      );
    const guard = combineIdeaTextGuard(titleGuard, descriptionGuard, judged);
    return {
      title: guard.fields?.title.approved ? result.title : null,
      description: guard.fields?.description.approved
        ? result.description
        : null,
      guard,
    };
  }
}
