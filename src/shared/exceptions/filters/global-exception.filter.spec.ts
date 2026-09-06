import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

import { WriteAuditEventService } from 'src/core/audit/services/write-audit-event.service';
import { RequestContextService } from 'src/core/request-context/request-context.service';
import { createExecutionContext } from 'src/core/request-context/utils';
import {
  LogActorType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

import { AppNotFoundException } from '../not-found.exception';
import { ErrorCode } from '../error-codes.enum';
import { ErrorResponse } from '../interfaces/error-response.interface';
import { GlobalExceptionFilter } from './global-exception.filter';

const host = (request: object) => {
  const sent: { status?: number; body?: ErrorResponse } = {};
  const response = {
    status: (status: number) => {
      sent.status = status;
      return { json: (body: ErrorResponse) => (sent.body = body) };
    },
  };
  return {
    sent,
    host: {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as unknown as ArgumentsHost,
  };
};

describe('GlobalExceptionFilter', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('mantém o envelope público sem os serviços (construção com new)', () => {
    const filter = new GlobalExceptionFilter();
    const { host: h, sent } = host({ url: '/clubs/1', method: 'GET' });
    filter.catch(
      new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      ),
      h,
    );

    expect(sent.status).toBe(404);
    expect(sent.body).toMatchObject({
      success: false,
      error: {
        code: ErrorCode.CLUB_NOT_FOUND,
        message: 'Clubinho não encontrado',
        path: '/clubs/1',
      },
    });
  });

  it.each([
    [
      new HttpException('Forbidden', HttpStatus.FORBIDDEN),
      403,
      ErrorCode.ACCESS_DENIED,
      'Forbidden',
    ],
    [
      new Error('bug'),
      500,
      ErrorCode.INTERNAL_ERROR,
      'Erro interno do servidor',
    ],
  ])('mapeia %p', (exception, status, code, message) => {
    const { host: h, sent } = host({ url: '/x', method: 'GET' });
    new GlobalExceptionFilter().catch(exception, h);
    expect(sent.status).toBe(status);
    expect(sent.body?.error).toMatchObject({ code, message });
  });

  it('com os serviços: copia o ator, registra status/código e fecha a auditoria uma vez', () => {
    const requestContext = new RequestContextService();
    const recordHttpOutcome = jest.fn();
    const filter = new GlobalExceptionFilter(requestContext, {
      recordHttpOutcome,
    } as unknown as WriteAuditEventService);

    requestContext.run(createExecutionContext(LogSourceType.Http), () => {
      const { host: h } = host({
        url: '/clubs/1?token=x',
        originalUrl: '/clubs/1?token=x',
        method: 'DELETE',
        user: { userId: 'u1', role: 'coordinator' },
      });
      filter.catch(new HttpException('Forbidden', HttpStatus.FORBIDDEN), h);

      expect(requestContext.get()).toMatchObject({
        actorType: LogActorType.User,
        actorId: 'u1',
        statusCode: 403,
        errorCode: ErrorCode.ACCESS_DENIED,
      });
      expect(recordHttpOutcome).toHaveBeenCalledTimes(1);
      expect(recordHttpOutcome).toHaveBeenCalledWith({
        statusCode: 403,
        errorCode: ErrorCode.ACCESS_DENIED,
        requestUrl: '/clubs/1?token=x',
      });
    });
  });

  it('5xx passa pelo logger.error (que persiste) e 4xx pelo warn', () => {
    const { host: h } = host({ url: '/x', method: 'GET' });
    new GlobalExceptionFilter().catch(new Error('bug'), h);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[INT_9001]'),
      expect.any(String),
    );
    new GlobalExceptionFilter().catch(new HttpException('x', 400), h);
    expect(warnSpy).toHaveBeenCalled();
  });
});
