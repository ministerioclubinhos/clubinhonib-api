import { CanActivate, Injectable } from '@nestjs/common';
import { AppForbiddenException, ErrorCode } from 'src/shared/exceptions';
import { GetIdeaAiEnhancementService } from '../services/get-idea-ai-enhancement.service';

/**
 * Flag `idea_ai_enhancement` desligada: nenhum endpoint de melhoria por IA
 * das ideias responde (pedir, cancelar, restaurar, editar documento).
 */
@Injectable()
export class IdeaAiEnabledGuard implements CanActivate {
  constructor(private readonly ai: GetIdeaAiEnhancementService) {}

  async canActivate(): Promise<boolean> {
    if (await this.ai.isEnabled()) return true;
    throw new AppForbiddenException(
      ErrorCode.FEATURE_DISABLED,
      'A melhoria de ideias por IA está desligada.',
    );
  }
}
