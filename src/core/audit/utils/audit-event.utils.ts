import { HttpStatus } from '@nestjs/common';

import {
  AUDITED_HTTP_METHODS,
  RESOURCE_ID_MAX_LENGTH,
  SAFE_RESOURCE_ID_PARAMS,
} from '../constants';
import { AuditHttpMethod, AuditOutcome } from '../enums';

/** Se o método é uma mutação e, portanto, gera evento de auditoria. */
export function isAuditedHttpMethod(
  method: string | null | undefined,
): boolean {
  return (
    Boolean(method) && AUDITED_HTTP_METHODS.has(String(method).toUpperCase())
  );
}

/** Resultado da ação a partir do status HTTP (D-003). */
export function outcomeFromStatus(statusCode: number): AuditOutcome {
  if (statusCode < 400) return AuditOutcome.Succeeded;
  if (
    statusCode === (HttpStatus.UNAUTHORIZED as number) ||
    statusCode === (HttpStatus.FORBIDDEN as number)
  ) {
    return AuditOutcome.Denied;
  }
  if (statusCode === (HttpStatus.NOT_FOUND as number))
    return AuditOutcome.NotFound;
  if (statusCode < 500) return AuditOutcome.Rejected;
  return AuditOutcome.Failed;
}

export function httpMethodOf(
  method: string | null | undefined,
): AuditHttpMethod | null {
  if (!method) return null;
  const upper = method.toUpperCase();
  return (Object.values(AuditHttpMethod) as string[]).includes(upper)
    ? (upper as AuditHttpMethod)
    : null;
}

const isSafeIdentifier = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= RESOURCE_ID_MAX_LENGTH &&
  /^[A-Za-z0-9_.:-]+$/.test(value);

/**
 * `resourceId` a partir dos parâmetros de rota, só de nomes allowlisted.
 *
 * Nunca percorre body ou query: um valor que veio do cliente identifica o
 * recurso pedido, e é só isso que fica registrado.
 */
export function extractResourceIdFromParams(params: unknown): string | null {
  if (typeof params !== 'object' || params === null) return null;
  for (const name of SAFE_RESOURCE_ID_PARAMS) {
    const value = (params as Record<string, unknown>)[name];
    if (isSafeIdentifier(value)) return value;
  }
  return null;
}

/** Em criação, só a propriedade `id` tipada do resultado, após narrowing. */
export function extractIdFromResult(result: unknown): string | null {
  if (typeof result !== 'object' || result === null) return null;
  const id = (result as { id?: unknown }).id;
  return isSafeIdentifier(id) ? id : null;
}

/** `ClubsModule.ClubsController.create` — sem catálogo manual. */
export function httpActionName(
  moduleName: string | null,
  controllerName: string | null,
  handlerName: string | null,
): string | null {
  if (!controllerName || !handlerName) return null;
  return `${moduleName ?? 'unknown-module'}.${controllerName}.${handlerName}`;
}

/** Junta prefixo do controller e caminho do handler em uma rota template. */
export function joinRoutePaths(
  controllerPath: unknown,
  handlerPath: unknown,
): string {
  const flattened: unknown[] = [controllerPath, handlerPath].flatMap(
    (part): unknown[] => (Array.isArray(part) ? (part as unknown[]) : [part]),
  );
  const parts = flattened
    .filter((part): part is string => typeof part === 'string')
    .join('/')
    .split('/')
    .filter(Boolean);
  return `/${parts.join('/')}`;
}
