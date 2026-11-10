import { Injectable } from '@nestjs/common';
import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import { IdeaAiGatewayProvider } from '../providers/idea-ai-gateway.provider';
import { IdeaAiAttachment, IdeaAiGuard } from '../types';
import { checkIdeaEssence } from '../utils';
import { IDEA_JUDGE_SCHEMA } from '../schemas';
import { IdeaEssenceJudgeDto } from '../dto/enhanced-idea.dto';
@Injectable()
export class IdeaEssenceGuardService {
  constructor(private readonly gateway: IdeaAiGatewayProvider) {}
  async verify(
    settings: InternalAiProviderSettings,
    original: string,
    enhanced: string,
    attachments: IdeaAiAttachment[] = [],
  ): Promise<IdeaAiGuard> {
    const deterministic = checkIdeaEssence(original, enhanced);
    if (!deterministic.approved) return deterministic;
    const judged = await this.gateway.json(
      settings,
      {
        schema: IDEA_JUDGE_SCHEMA,
        attachments,
        instructions:
          'Julgue com rigor a preservação de TODAS as informações, nomes, quantidades, atividades, materiais, ordem e número de etapas/seções. Não aprove alterações de essência. Para imagens compare também textos, proporção, objetos e rostos. Retorne preservesEssence e violations em português. A primeira imagem é original, a segunda é a proposta.',
        data: { original, enhanced },
      },
      IdeaEssenceJudgeDto,
    );
    return {
      approved: judged.preservesEssence && !judged.violations.length,
      violations: judged.preservesEssence
        ? judged.violations
        : judged.violations.length
          ? judged.violations
          : ['A revisão de essência não aprovou esta versão.'],
    };
  }
}
