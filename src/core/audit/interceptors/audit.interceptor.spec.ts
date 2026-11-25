import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';

import { RequestContextService } from 'src/core/request-context/request-context.service';
import { createExecutionContext } from 'src/core/request-context/utils';
import {
  LogActorType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

import { WriteAuditEventService } from '../services/write-audit-event.service';
import { AuditInterceptor } from './audit.interceptor';

const httpContext = (request: object, statusCode = 200): ExecutionContext =>
  ({
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode }),
    }),
  }) as unknown as ExecutionContext;

describe('AuditInterceptor', () => {
  const requestContext = new RequestContextService();
  const recordHttpOutcome = jest.fn();
  const interceptor = new AuditInterceptor(requestContext, {
    recordHttpOutcome,
  } as unknown as WriteAuditEventService);

  beforeEach(() => recordHttpOutcome.mockClear());

  it('no sucesso copia o ator validado, o id criado em POST e fecha a auditoria', async () => {
    await requestContext.run(
      createExecutionContext(LogSourceType.Http),
      async () => {
        const next: CallHandler = {
          handle: () => of({ id: 'novo', name: 'segredo' }),
        };
        const result = await lastValueFrom(
          interceptor.intercept(
            httpContext(
              {
                method: 'POST',
                originalUrl: '/clubs',
                user: { userId: 'u1', role: 'admin' },
              },
              201,
            ),
            next,
          ),
        );

        expect(result).toEqual({ id: 'novo', name: 'segredo' });
        expect(requestContext.get()).toMatchObject({
          actorType: LogActorType.User,
          actorId: 'u1',
          resourceId: 'novo',
        });
        expect(recordHttpOutcome).toHaveBeenCalledWith({
          statusCode: 201,
          errorCode: null,
          requestUrl: '/clubs',
        });
      },
    );
  });

  it('no erro não grava: o filtro é quem fecha a request', async () => {
    await requestContext.run(
      createExecutionContext(LogSourceType.Http),
      async () => {
        const next: CallHandler = {
          handle: () => throwError(() => new Error('x')),
        };
        await expect(
          lastValueFrom(
            interceptor.intercept(httpContext({ method: 'GET' }), next),
          ),
        ).rejects.toThrow('x');
        expect(recordHttpOutcome).not.toHaveBeenCalled();
      },
    );
  });

  it('GET não tenta ler id da resposta', async () => {
    await requestContext.run(
      createExecutionContext(LogSourceType.Http),
      async () => {
        await lastValueFrom(
          interceptor.intercept(httpContext({ method: 'GET' }), {
            handle: () => of({ id: 'x' }),
          }),
        );
        expect(requestContext.get()?.resourceId).toBeNull();
      },
    );
  });
});
