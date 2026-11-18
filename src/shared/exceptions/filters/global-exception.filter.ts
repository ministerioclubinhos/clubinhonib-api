import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { WriteAuditEventService } from 'src/core/audit/services/write-audit-event.service';
import { WriteTechnicalLogService } from 'src/core/observability/services/write-technical-log.service';
import { RequestContextService } from 'src/core/request-context/request-context.service';
import { actorFromRequestUser } from 'src/core/request-context/utils';

import { AppException } from '../base.exception';
import { ErrorCode } from '../error-codes.enum';
import { ErrorResponse } from '../interfaces/error-response.interface';

/**
 * Filtro global de exceções.
 *
 * O envelope `{ success: false, error }` é contrato público e não muda. O que
 * o filtro acrescenta é o fechamento da request no contexto: ator (se algum
 * guard já o validou), status e código para o registro técnico, e a auditoria
 * de falha — uma só, porque o interceptor não roda quando o handler lança.
 *
 * Os serviços são opcionais para o filtro continuar construível com `new`
 * nos testes e em qualquer bootstrap sem os módulos de auditoria.
 */
@Injectable()
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(
    @Optional() private readonly requestContext?: RequestContextService,
    @Optional() private readonly audit?: WriteAuditEventService,
    @Optional() private readonly technicalLog?: WriteTechnicalLogService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { user?: unknown }>();

    const errorResponse = this.buildErrorResponse(exception, request);
    const status = this.getHttpStatus(exception);

    this.requestContext?.assignActor(actorFromRequestUser(request.user));
    this.requestContext?.assignOutcome(status, errorResponse.error.code);

    if (status >= 500) {
      this.logger.error(
        `[${errorResponse.error.code}] ${errorResponse.error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${errorResponse.error.code}] ${errorResponse.error.message} - ${request.method} ${request.url}`,
      );
      // Erro do cliente também é erro: vai à observabilidade como `warn`,
      // menos o ruído (401 e rota inexistente).
      this.technicalLog?.reportClientError({
        statusCode: status,
        context: GlobalExceptionFilter.name,
        message: `[${errorResponse.error.code}] ${errorResponse.error.message}`,
        error: exception,
      });
    }

    response.status(status).json(errorResponse);

    this.audit?.recordHttpOutcome({
      statusCode: status,
      errorCode: errorResponse.error.code,
      requestUrl: request.originalUrl ?? request.url ?? null,
    });
  }

  private buildErrorResponse(
    exception: unknown,
    request: Request,
  ): ErrorResponse {
    if (exception instanceof AppException) {
      return {
        success: false,
        error: {
          code: exception.code,
          message: exception.message,
          details: exception.details,
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };
    }

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : (response as { message?: string | string[] }).message;

      return {
        success: false,
        error: {
          code: this.mapHttpStatusToErrorCode(exception.getStatus()),
          message: Array.isArray(message)
            ? message.join(', ')
            : message || 'Erro na requisição',
          timestamp: new Date().toISOString(),
          path: request.url,
        },
      };
    }

    return {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Erro interno do servidor',
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    };
  }

  private getHttpStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    const statusMap: Record<number, ErrorCode> = {
      400: ErrorCode.VALIDATION_ERROR,
      401: ErrorCode.TOKEN_INVALID,
      403: ErrorCode.ACCESS_DENIED,
      404: ErrorCode.RESOURCE_NOT_FOUND,
      409: ErrorCode.RESOURCE_CONFLICT,
      422: ErrorCode.VALIDATION_ERROR,
      500: ErrorCode.INTERNAL_ERROR,
    };
    return statusMap[status] || ErrorCode.INTERNAL_ERROR;
  }
}
