import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../base.exception';
import { ErrorCode } from '../error-codes.enum';
import { ErrorResponse } from '../interfaces/error-response.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);
    const status = this.getHttpStatus(exception);

    if (status >= 500) {
      this.logger.error(
        `[${errorResponse.error.code}] ${errorResponse.error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${errorResponse.error.code}] ${errorResponse.error.message} - ${request.method} ${request.url}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  private buildErrorResponse(exception: unknown, request: Request): ErrorResponse {
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
      const message = typeof response === 'string'
        ? response
        : (response as { message?: string | string[] }).message;

      return {
        success: false,
        error: {
          code: this.mapHttpStatusToErrorCode(exception.getStatus()),
          message: Array.isArray(message) ? message.join(', ') : message || 'Erro na requisição',
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
