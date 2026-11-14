import { Injectable, Logger } from '@nestjs/common';

import { AccessContext } from 'src/core/auth/auth.types';
import { GetChildrenService } from 'src/modules/children/services/get-children.service';
import {
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';

import { DECISION_RULE_MESSAGES } from '../constants';
import { AcceptedChristRepository } from '../repositories/accepted-christ.repository';
import { assertCanRegisterDecision, decisionRemovalRefusal } from '../utils';

/**
 * Exclui uma decisão lançada por engano.
 *
 * Quem pode registrar pode desfazer, dentro do mesmo alcance: a decisão de uma
 * criança de outro clubinho responde "não encontrada", igual ao que responderia
 * se não existisse.
 */
@Injectable()
export class DeleteAcceptedChristService {
  private readonly logger = new Logger(DeleteAcceptedChristService.name);

  constructor(
    private readonly acceptedChristRepository: AcceptedChristRepository,
    private readonly getChildrenService: GetChildrenService,
  ) {}

  async remove(
    context: AccessContext,
    id: string,
  ): Promise<{ message: string }> {
    assertCanRegisterDecision(context);

    const stored = await this.acceptedChristRepository.findByIdWithChild(id);
    if (!stored) throw this.notFound();

    // O módulo de crianças confere o alcance; fora dele, a decisão não existe.
    await this.getChildrenService
      .findEntityForContextOrFail(stored.child.id, context)
      .catch(() => {
        throw this.notFound();
      });

    const all = await this.acceptedChristRepository.findDecisionsOfChild(
      stored.child.id,
    );
    const refusal = decisionRemovalRefusal({
      decision: stored.decision,
      others: all.filter((row) => row.id !== id).map((row) => row.decision),
    });
    if (refusal) {
      throw new AppConflictException(
        ErrorCode.DECISION_RULE_VIOLATION,
        refusal,
      );
    }

    await this.acceptedChristRepository.deleteById(id);
    this.logger.log(
      `Decisão excluída. id=${id} criança=${stored.child.id} por=${context.userId ?? '-'}`,
    );

    return { message: 'Decisão excluída com sucesso' };
  }

  private notFound(): AppNotFoundException {
    return new AppNotFoundException(
      ErrorCode.DECISION_NOT_FOUND,
      DECISION_RULE_MESSAGES.NOT_FOUND,
    );
  }
}
