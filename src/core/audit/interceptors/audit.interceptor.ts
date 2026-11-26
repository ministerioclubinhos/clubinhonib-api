import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

import { RequestContextService } from 'src/core/request-context/request-context.service';
import { actorFromRequestUser } from 'src/core/request-context/utils';

import { AuditHttpMethod } from '../enums';
import { WriteAuditEventService } from '../services/write-audit-event.service';
import { extractIdFromResult } from '../utils/audit-event.utils';

/**
 * Interceptor global: fecha a auditoria das requests bem-sucedidas.
 *
 * Roda depois dos guards, então `request.user` já é a identidade validada
 * pelo Passport. A request que lança não passa por aqui: quem a grava é o
 * filtro global, e a flag no contexto impede que os dois gravem.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly requestContext: RequestContextService,
    private readonly audit: WriteAuditEventService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request & { user?: unknown }>();
    const response = http.getResponse<Response>();

    this.requestContext.assignActor(actorFromRequestUser(request.user));

    return next.handle().pipe(
      tap((result: unknown) => {
        if (request.method === (AuditHttpMethod.POST as string)) {
          this.requestContext.assignResourceId(extractIdFromResult(result));
        }
        this.audit.recordHttpOutcome({
          statusCode: response.statusCode,
          errorCode: null,
          requestUrl: request.originalUrl ?? request.url ?? null,
        });
      }),
    );
  }
}
