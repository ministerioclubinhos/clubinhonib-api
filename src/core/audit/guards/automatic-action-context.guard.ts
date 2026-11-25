import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Request } from 'express';

import { ComponentsRegistry } from 'src/core/request-context/discovery/components.registry';
import { RequestContextService } from 'src/core/request-context/request-context.service';
import { resourceTypeFromRoute } from 'src/core/request-context/utils';

import {
  extractResourceIdFromParams,
  joinRoutePaths,
} from '../utils/audit-event.utils';

/**
 * Guard global *pass-through*: nunca nega; só descobre a ação.
 *
 * Roda antes de qualquer guard de autenticação, então mesmo uma request
 * negada por `JwtAuthGuard` chega ao filtro com módulo, controller, handler e
 * rota resolvidos. É o que permite auditar sem decorator por endpoint.
 */
@Injectable()
export class AutomaticActionContextGuard implements CanActivate {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly registry: ComponentsRegistry,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const controller = context.getClass();
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest<Request>();
    const routeTemplate = this.routeTemplateOf(request, controller, handler);

    this.requestContext.assignAction({
      moduleName: this.registry.moduleOf(controller),
      controllerName: controller.name,
      handlerName: handler.name,
      routeTemplate,
      httpMethod: request.method,
      resourceType: resourceTypeFromRoute(routeTemplate),
      // Capturado antes do handler: em `DELETE` a resposta não traz o id.
      resourceId: extractResourceIdFromParams(request.params),
    });

    return true;
  }

  private routeTemplateOf(
    request: Request,
    controller: object,
    handler: object,
  ): string {
    const matched = (request as { route?: { path?: unknown } }).route?.path;
    if (typeof matched === 'string') return matched;
    return joinRoutePaths(
      Reflect.getMetadata(PATH_METADATA, controller) as unknown,
      Reflect.getMetadata(PATH_METADATA, handler) as unknown,
    );
  }
}
