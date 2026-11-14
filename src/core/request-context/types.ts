import { UserRole } from 'src/core/auth/auth.types';
import {
  LogActorType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

/**
 * O que se sabe sobre a execução em curso.
 *
 * Um objeto por request (ou por job), guardado em `AsyncLocalStorage`; os
 * providers são singleton e não podem carregar nada disso em propriedade.
 */
export interface RequestExecutionContext {
  requestId: string;
  startedAtEpochMs: number;
  sourceType: LogSourceType;
  moduleName: string | null;
  controllerName: string | null;
  handlerName: string | null;
  routeTemplate: string | null;
  httpMethod: string | null;
  actorType: LogActorType;
  actorId: string | null;
  actorRole: UserRole | null;
  /** Nome de exibição do ator; só a auditoria o persiste. */
  actorName: string | null;
  resourceType: string | null;
  resourceId: string | null;
  jobName: string | null;
  /** Preenchido pelo filtro antes de logar, para o registro técnico. */
  statusCode: number | null;
  errorCode: string | null;
  /** Impede que interceptor e filtro gravem a mesma ação duas vezes. */
  auditWritten: boolean;
  /** Um registro técnico desta execução já foi gravado (evita o eco do filtro). */
  technicalLogWritten: boolean;
}

/** Ação descoberta pelo guard global antes dos guards de autenticação. */
export interface ActionDescriptor {
  moduleName: string;
  controllerName: string;
  handlerName: string;
  routeTemplate: string;
  httpMethod: string;
  resourceType: string | null;
  resourceId: string | null;
}

export interface ActorDescriptor {
  actorId: string;
  actorRole: UserRole | null;
  actorName?: string | null;
}

/** Componente (controller ou provider) e o módulo que o declarou. */
export interface DiscoveredComponent {
  componentName: string;
  moduleName: string;
  kind: 'controller' | 'provider';
}
