import { Injectable } from '@nestjs/common';

import { RequestContextService } from 'src/core/request-context/request-context.service';
import { createExecutionContext } from 'src/core/request-context/utils';
import { AppException } from 'src/shared/exceptions/base.exception';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import { AuditOutcome } from '../enums';
import { BoundaryDescriptor } from '../types';
import { WriteAuditEventService } from './write-audit-event.service';

/**
 * O único wrapper para ações fora do HTTP (D-002): jobs agendados e operações
 * de sistema.
 *
 * Abre um contexto próprio (com `requestId` de correlação e ator `system`),
 * executa o trabalho dentro dele — assim todo `Logger.error` disparado no
 * caminho carrega o `jobName` — e grava a auditoria com o resultado.
 */
@Injectable()
export class ActionBoundaryService {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly audit: WriteAuditEventService,
  ) {}

  /**
   * `outcomeOf` traduz o resultado em `AuditOutcome`; `null` significa que a
   * execução não chegou a ser uma ação (ex.: job dispensado) e não é auditada.
   */
  async run<T>(
    descriptor: BoundaryDescriptor,
    execute: () => Promise<T>,
    outcomeOf: (result: T) => AuditOutcome | null,
  ): Promise<T> {
    const ctx = createExecutionContext(LogSourceType.Job);
    ctx.jobName = descriptor.jobName;
    ctx.handlerName = descriptor.actionName;

    return this.requestContext.run(ctx, async () => {
      try {
        const result = await execute();
        const outcome = outcomeOf(result);
        if (outcome) {
          this.audit.recordBoundaryOutcome(ctx, descriptor, {
            outcome,
            errorCode: null,
            statusCode: null,
          });
        }
        return result;
      } catch (error: unknown) {
        this.audit.recordBoundaryOutcome(ctx, descriptor, {
          outcome: AuditOutcome.Failed,
          errorCode: error instanceof AppException ? error.code : null,
          statusCode: null,
        });
        throw error;
      }
    });
  }
}
