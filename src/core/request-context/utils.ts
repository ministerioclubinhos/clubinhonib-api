import { randomUUID } from 'node:crypto';

import { normalizeRole } from 'src/core/auth/role.utils';
import {
  LogActorType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

import {
  ACTOR_NAME_MAX_LENGTH,
  ROUTE_PATH_MAX_LENGTH,
  UNMATCHED_ROUTE_ACTION_NAME,
} from './constants';
import { ActorDescriptor, RequestExecutionContext } from './types';

/** Um contexto novo, ainda sem ação nem ator. */
export function createExecutionContext(
  sourceType: LogSourceType,
  now: number = Date.now(),
  requestId: string = randomUUID(),
): RequestExecutionContext {
  return {
    requestId,
    startedAtEpochMs: now,
    sourceType,
    moduleName: null,
    controllerName: null,
    handlerName: null,
    routeTemplate: null,
    httpMethod: null,
    actorType:
      sourceType === LogSourceType.Http
        ? LogActorType.Anonymous
        : LogActorType.System,
    actorId: null,
    actorRole: null,
    actorName: null,
    resourceType: null,
    resourceId: null,
    jobName: null,
    statusCode: null,
    errorCode: null,
    auditWritten: false,
    technicalLogWritten: false,
  };
}

/**
 * Lê o ator de `request.user`, só com o que o Passport validou.
 *
 * `userId` vindo de body, query ou param nunca chega aqui: identifica um
 * recurso, não prova quem executou a ação.
 */
/** Nome de exibição limpo e limitado, ou `null` quando não há um. */
export function actorDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  return name ? name.slice(0, ACTOR_NAME_MAX_LENGTH) : null;
}

/** Forma de busca do nome: minúsculas e sem acento. */
export function actorNameSearchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function actorFromRequestUser(user: unknown): ActorDescriptor | null {
  if (typeof user !== 'object' || user === null) return null;
  const userId = (user as { userId?: unknown }).userId;
  if (typeof userId !== 'string' || !userId) return null;
  const role = (user as { role?: unknown }).role;
  return {
    actorId: userId,
    actorRole: normalizeRole(typeof role === 'string' ? role : null) ?? null,
    actorName: actorDisplayName((user as { name?: unknown }).name),
  };
}

/**
 * Nome de boundary para uma request sem handler (404).
 *
 * A query string cai fora e segmentos que parecem identificador viram `:id`,
 * para o nome não carregar dado pessoal nem virar um valor por request.
 */
export function unmatchedRouteName(method: string, url: string): string {
  const path = url.split('?')[0] || '/';
  const sanitized = path
    .split('/')
    .map((segment) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        segment,
      ) || /^\d+$/.test(segment)
        ? ':id'
        : segment,
    )
    .join('/')
    .slice(0, ROUTE_PATH_MAX_LENGTH);
  return `${UNMATCHED_ROUTE_ACTION_NAME}.${method.toUpperCase()} ${sanitized}`;
}

/** Primeiro segmento da rota: `/clubs/:id` -> `clubs`; raiz -> `root`. */
export function resourceTypeFromRoute(routeTemplate: string): string {
  const [first] = routeTemplate.split('/').filter(Boolean);
  return first ? first.replace(/[:{}*]/g, '') || 'root' : 'root';
}
