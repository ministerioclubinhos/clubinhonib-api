import { ConsoleLogger, Injectable } from '@nestjs/common';

import { LogLevel } from '../enums';
import { WriteTechnicalLogService } from '../services/write-technical-log.service';
import { parseLogCall } from '../utils/log-call.utils';

/**
 * Logger da aplicação: imprime como o Nest sempre imprimiu e, para erros,
 * também persiste um registro estruturado.
 *
 * Cobre todos os módulos que já usam `Logger` sem mudar nenhuma chamada: o
 * módulo de origem é resolvido pelo `context`, e request/ator vêm do contexto
 * da execução.
 */
@Injectable()
export class StructuredLoggerService extends ConsoleLogger {
  private persisting = false;

  constructor(private readonly technicalLog: WriteTechnicalLogService) {
    super();
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    super.error(message, ...optionalParams);
    this.persist(LogLevel.Error, message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    super.fatal(message, ...optionalParams);
    this.persist(LogLevel.Fatal, message, optionalParams);
  }

  private persist(
    level: LogLevel,
    message: unknown,
    optionalParams: unknown[],
  ): void {
    // Reentrância: se montar o registro lançar e alguém logar de novo, para.
    if (this.persisting) return;
    this.persisting = true;
    try {
      const call = parseLogCall(message, optionalParams);
      this.technicalLog.report({
        level,
        context: call.context ?? this.context ?? null,
        message: call.message,
        error: call.error,
        stack: call.stack,
      });
    } catch {
      // O console já recebeu a linha; falhar aqui não pode derrubar quem logou.
    } finally {
      this.persisting = false;
    }
  }
}
