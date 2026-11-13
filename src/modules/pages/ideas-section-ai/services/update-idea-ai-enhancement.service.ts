import { Injectable, Logger } from '@nestjs/common';
import {
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { IDEA_AI_ACTIVE, IDEA_AI_RESULTS } from '../constants';

/** Ações da administração sobre tentativas existentes. */
@Injectable()
export class UpdateIdeaAiEnhancementService {
  private readonly logger = new Logger(UpdateIdeaAiEnhancementService.name);

  constructor(private readonly repo: IdeasSectionAiRepository) {}

  /**
   * Cancela a tentativa em andamento. Não consome uma das tentativas. Chamadas
   * já enviadas ao provedor terminam, mas o worker para no próximo item e
   * descarta o que gerou.
   */
  async cancel(sectionId: string): Promise<void> {
    await this.repo.transaction(async (manager) => {
      const section = await this.repo.lockSection(sectionId, manager);
      if (!section)
        throw new AppNotFoundException(
          ErrorCode.IDEA_NOT_FOUND,
          'Ideia não encontrada.',
        );
      if (!(await this.repo.cancel(sectionId, manager)))
        throw new AppConflictException(
          ErrorCode.IDEA_AI_NO_ACTIVE_ATTEMPT,
          'Não há melhoria em andamento para cancelar.',
        );
    });
    this.logger.log(`Melhoria em andamento da ideia ${sectionId} cancelada.`);
  }

  /**
   * Volta a comparar e publicar o resultado de uma tentativa anterior. As
   * escolhas feitas para o resultado que sai deixam de valer (409 de decisões
   * desatualizadas na publicação).
   */
  async restore(sectionId: string, enhancementId: string): Promise<void> {
    await this.repo.transaction(async (manager) => {
      const section = await this.repo.lockSection(sectionId, manager);
      if (!section)
        throw new AppNotFoundException(
          ErrorCode.IDEA_NOT_FOUND,
          'Ideia não encontrada.',
        );
      if (section.page)
        throw new AppConflictException(
          ErrorCode.IDEA_AI_ALREADY_PUBLISHED,
          'Esta ideia já foi publicada.',
        );
      const history = await this.repo.attempts([sectionId], manager);
      if (history.some((a) => IDEA_AI_ACTIVE.includes(a.status)))
        throw new AppConflictException(
          ErrorCode.IDEA_AI_ENHANCEMENT_IN_PROGRESS,
          'Aguarde a melhoria em andamento ou cancele-a antes de trocar o resultado.',
        );
      const target = history.find((a) => a.id === enhancementId);
      if (!target || !IDEA_AI_RESULTS.includes(target.status))
        throw new AppNotFoundException(
          ErrorCode.IDEA_AI_RESULT_UNAVAILABLE,
          'Esta tentativa não tem resultado para usar.',
        );
      await this.repo.setCurrent(sectionId, enhancementId, manager);
    });
  }
}
