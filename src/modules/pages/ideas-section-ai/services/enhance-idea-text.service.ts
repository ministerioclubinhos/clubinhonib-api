import { Injectable } from '@nestjs/common';
import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { IdeaEssenceGuardService } from './idea-essence-guard.service';
import { EnhancedIdeaTextDto } from '../dto/enhanced-idea.dto';
import { IDEA_TEXT_SCHEMA } from '../schemas';
import { IdeaAiTextResult } from '../types';
@Injectable()
export class EnhanceIdeaTextService {
  constructor(
    private readonly gateway: IdeaAiGatewayProvider,
    private readonly guard: IdeaEssenceGuardService,
  ) {}
  async enhance(
    settings: InternalAiProviderSettings,
    title: string,
    description: string,
  ): Promise<IdeaAiTextResult> {
    const result = await this.gateway.json(
      settings,
      {
        schema: IDEA_TEXT_SCHEMA,
        instructions:
          'Corrija título (1–120 caracteres) e descrição. Organize somente as informações existentes. Texto simples, sem HTML. Retorne title, description e changes.',
        data: { title, description },
      },
      EnhancedIdeaTextDto,
    );
    const guard = await this.guard.verify(
      settings,
      `${title}\n${description}`,
      `${result.title}\n${result.description}`,
    );
    return {
      title: guard.approved ? result.title : null,
      description: guard.approved ? result.description : null,
      guard,
    };
  }
}
