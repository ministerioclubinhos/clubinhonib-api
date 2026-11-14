import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import { REQUEST_ID_HEADER } from './constants';
import { requestContextStorage } from './request-context.storage';
import { createExecutionContext } from './utils';

/**
 * Abre o contexto de cada request antes de qualquer guard ou handler.
 *
 * O `requestId` é gerado aqui, no servidor: um valor vindo do cliente não é
 * confiável como chave de correlação e por isso é ignorado. O id volta no
 * cabeçalho `X-Request-Id` para quem precisar reportar um erro.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const context = createExecutionContext(LogSourceType.Http);
    context.httpMethod = request.method;
    response.setHeader(REQUEST_ID_HEADER, context.requestId);
    requestContextStorage.run(context, () => next());
  }
}
