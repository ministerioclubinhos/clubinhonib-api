import { Injectable } from '@nestjs/common';

import { LogActorType } from 'src/shared/providers/log-storage/enums';

import { requestContextStorage } from './request-context.storage';
import {
  ActionDescriptor,
  ActorDescriptor,
  RequestExecutionContext,
} from './types';

/**
 * Acesso ao contexto da execução em curso.
 *
 * Tudo aqui é tolerante à ausência: um job, um hook de processo ou um teste
 * unitário podem rodar sem contexto, e nenhum chamador deve quebrar por isso.
 */
@Injectable()
export class RequestContextService {
  /** Executa `fn` dentro de um contexto novo, isolado dos demais. */
  run<T>(context: RequestExecutionContext, fn: () => T): T {
    return requestContextStorage.run(context, fn);
  }

  get(): RequestExecutionContext | null {
    return requestContextStorage.getStore() ?? null;
  }

  requestId(): string | null {
    return this.get()?.requestId ?? null;
  }

  /** Guarda a ação descoberta pelo guard global. */
  assignAction(action: ActionDescriptor): void {
    const context = this.get();
    if (!context) return;
    context.moduleName = action.moduleName;
    context.controllerName = action.controllerName;
    context.handlerName = action.handlerName;
    context.routeTemplate = action.routeTemplate;
    context.httpMethod = action.httpMethod;
    context.resourceType = action.resourceType;
    context.resourceId = action.resourceId;
  }

  /**
   * Registra quem executa a ação.
   *
   * Chamado com `request.user` depois dos guards e, nos fluxos de login e
   * cadastro, pelo próprio caso de uso assim que resolve o usuário — a única
   * integração manual permitida, porque o boundary não tem como inferir isso.
   */
  assignActor(actor: ActorDescriptor | null): void {
    const context = this.get();
    if (!context || !actor) return;
    context.actorType = LogActorType.User;
    context.actorId = actor.actorId;
    context.actorRole = actor.actorRole;
    // Token antigo não traz o nome: não apaga o que o login já informou.
    if (actor.actorName) context.actorName = actor.actorName;
  }

  assignResourceId(resourceId: string | null): void {
    const context = this.get();
    if (!context || !resourceId || context.resourceId) return;
    context.resourceId = resourceId;
  }

  assignOutcome(statusCode: number | null, errorCode: string | null): void {
    const context = this.get();
    if (!context) return;
    context.statusCode = statusCode;
    context.errorCode = errorCode;
  }

  /** `true` na primeira chamada; `false` quando a ação já foi gravada. */
  claimAuditWrite(): boolean {
    const context = this.get();
    if (!context || context.auditWritten) return false;
    context.auditWritten = true;
    return true;
  }
}
