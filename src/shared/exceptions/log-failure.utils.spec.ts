import { logRequestFailure } from './log-failure.utils';
import { AppInternalException } from './internal.exception';
import { AppNotFoundException } from './not-found.exception';
import { ErrorCode } from './error-codes.enum';

describe('logRequestFailure', () => {
  const logger = { warn: jest.fn(), error: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('recusa esperada vira aviso, nunca erro interno', () => {
    logRequestFailure(
      logger,
      new AppNotFoundException(ErrorCode.IDEA_NOT_FOUND, 'não encontrada'),
      'Erro ao excluir',
      'stack',
    );

    expect(logger.warn).toHaveBeenCalledWith('Erro ao excluir (HTTP 404)');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it.each([
    new AppInternalException(ErrorCode.SECTION_DELETE_ERROR, 'falhou'),
    new Error('banco fora do ar'),
  ])('falha de verdade continua como erro, com a pilha', (error) => {
    logRequestFailure(logger, error, 'Erro ao excluir', 'stack');

    expect(logger.error).toHaveBeenCalledWith('Erro ao excluir', 'stack');
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('sem pilha, registra só a mensagem', () => {
    logRequestFailure(logger, 'texto solto', 'Erro');

    expect(logger.error).toHaveBeenCalledWith('Erro');
  });
});
