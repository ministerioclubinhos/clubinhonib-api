import { HttpException, HttpStatus, LoggerService } from '@nestjs/common';

/**
 * Registra a falha de um caso de uso que vai ser relançada.
 *
 * Recusa esperada (4xx: não encontrado, regra de negócio, validação) é aviso.
 * Como `error`, ela era gravada pela observabilidade como erro interno
 * (`INT_9001`) e enchia o painel de alarmes falsos.
 */
export function logRequestFailure(
  logger: Pick<LoggerService, 'warn' | 'error'>,
  error: unknown,
  message: string,
  stack?: string,
): void {
  if (
    error instanceof HttpException &&
    error.getStatus() < Number(HttpStatus.INTERNAL_SERVER_ERROR)
  ) {
    logger.warn(`${message} (HTTP ${error.getStatus()})`);
    return;
  }

  if (stack) logger.error(message, stack);
  else logger.error(message);
}
