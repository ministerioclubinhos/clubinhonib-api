import { HttpStatus } from '@nestjs/common';
import { AppException } from 'src/shared/exceptions/base.exception';
import { ErrorCode } from 'src/shared/exceptions/error-codes.enum';
import { AiQueueFailure } from './enums';

const MESSAGES: Readonly<Record<AiQueueFailure, string>> = {
  [AiQueueFailure.UNAVAILABLE]:
    'A fila de IA está indisponível. Verifique a conexão com o Redis e tente novamente.',
  [AiQueueFailure.CANCELLED]:
    'A solicitação à fila de IA foi cancelada. Tente novamente.',
  [AiQueueFailure.ORPHANED]:
    'A solicitação à fila de IA foi interrompida por reinício do servidor. Tente novamente.',
  [AiQueueFailure.EXPIRED]:
    'O tempo de espera da fila de IA foi excedido. Tente novamente.',
  [AiQueueFailure.RESULT_EXPIRED]:
    'O tempo de espera da fila de IA foi excedido. Tente novamente.',
  [AiQueueFailure.INVALID_REQUEST]:
    'A chamada ao provedor de IA não é válida para a fila.',
  [AiQueueFailure.CREDENTIAL_MISSING]:
    'API_KEY não configurada ou ilegível para o provedor de IA selecionado.',
};

/**
 * Failure of the queue/transport itself (never a provider answer). Consumers
 * identify it with `instanceof AiQueueException` and branch on `reason`.
 */
export class AiQueueException extends AppException {
  constructor(readonly reason: AiQueueFailure) {
    super(
      ErrorCode.AI_QUEUE_UNAVAILABLE,
      MESSAGES[reason],
      reason === AiQueueFailure.INVALID_REQUEST
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.SERVICE_UNAVAILABLE,
      { reason },
    );
  }
}
