import { Injectable, Logger } from '@nestjs/common';

import { AccessContext } from 'src/core/auth/auth.types';
import { AppConflictException, ErrorCode } from 'src/shared/exceptions';
import { GetChildrenService } from 'src/modules/children/services/get-children.service';

import { AcceptedChristResponseDto } from '../dtos/accepted-christ-response.dto';
import { CreateAcceptedChristDto } from '../dtos/create-accepted-christ.dto';
import { toAcceptedChristResponse } from '../mappers';
import { AcceptedChristRepository } from '../repositories/accepted-christ.repository';
import { assertCanRegisterDecision, decisionRefusal } from '../utils';
import { NotifyAcceptedChristService } from './notify-accepted-christ.service';

/**
 * Registra a decisão de uma criança.
 *
 * Quem confere o alcance é o módulo de crianças: o professor só enxerga as
 * crianças do clubinho dele, e pedir a criança por lá aplica esse recorte de
 * graça. A criança de outro clubinho responde "não encontrada", que é o mesmo
 * que responderia se ela não existisse — a resposta não conta em qual clubinho
 * ela está.
 *
 * Regras: aceitar é uma vez só; reconciliar exige ter aceitado; criança
 * desativada não recebe decisão.
 */
@Injectable()
export class CreateAcceptedChristService {
  private readonly logger = new Logger(CreateAcceptedChristService.name);

  constructor(
    private readonly acceptedChristRepository: AcceptedChristRepository,
    private readonly getChildrenService: GetChildrenService,
    private readonly notifyAcceptedChrist: NotifyAcceptedChristService,
  ) {}

  async create(
    context: AccessContext,
    dto: CreateAcceptedChristDto,
  ): Promise<AcceptedChristResponseDto> {
    assertCanRegisterDecision(context);

    const child = await this.getChildrenService.findEntityForContextOrFail(
      dto.childId,
      context,
    );

    const existing = await this.acceptedChristRepository.findDecisionsOfChild(
      child.id,
    );
    const refusal = decisionRefusal({
      decision: dto.decision,
      childIsActive: child.isActive,
      existing: existing.map((row) => row.decision),
    });
    if (refusal) {
      throw new AppConflictException(
        child.isActive
          ? ErrorCode.DECISION_RULE_VIOLATION
          : ErrorCode.CHILD_INACTIVE,
        refusal,
      );
    }

    const saved = await this.acceptedChristRepository.createForChild({
      childId: child.id,
      decision: dto.decision,
      notes: dto.notes ?? null,
    });

    // Só o identificador entra no registro: a decisão de uma criança e a
    // observação de quem a acompanhou não vão para o log.
    this.logger.log(
      `Decisão registrada. id=${saved.id} criança=${child.id} por=${context.userId ?? '-'}`,
    );

    // Depois de gravar e fora da requisição: o clubinho fica sabendo, e uma
    // falha de e-mail não desfaz o registro da decisão.
    this.notifyAcceptedChrist.notifyInBackground(saved, child);

    return toAcceptedChristResponse(saved, child.id);
  }
}
