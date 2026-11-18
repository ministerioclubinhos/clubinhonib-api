import {
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';

import { LogSourceType } from 'src/shared/providers/log-storage/enums';
import { emergencyWrite } from 'src/shared/providers/log-storage/utils';

import { PROCESS_FLUSH_TIMEOUT_MS } from '../constants';
import { LogLevel } from '../enums';
import { WriteTechnicalLogService } from '../services/write-technical-log.service';

type ExitFn = (code: number) => void;

/**
 * Captura o que escapa de todo `catch`: promise rejeitada sem tratamento e
 * exceção não capturada.
 *
 * A rejeição é registrada e o processo segue. A exceção é fatal: registra em
 * melhor esforço, espera a fila até o limite e encerra — manter um processo
 * em estado desconhecido vivo é pior que reiniciá-lo.
 */
@Injectable()
export class ProcessErrorListenersService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly onRejection = (reason: unknown): void => {
    this.technicalLog.report({
      level: LogLevel.Error,
      context: ProcessErrorListenersService.name,
      message: 'Promise rejeitada sem tratamento',
      error: reason,
      sourceType: LogSourceType.Process,
    });
  };

  private readonly onException = (error: Error): void => {
    this.technicalLog.report({
      level: LogLevel.Fatal,
      context: ProcessErrorListenersService.name,
      message: 'Exceção não capturada; encerrando o processo',
      error,
      sourceType: LogSourceType.Process,
    });
    void this.flushAndExit();
  };

  private exit: ExitFn = (code) => process.exit(code);
  private target: NodeJS.Process = process;

  constructor(private readonly technicalLog: WriteTechnicalLogService) {}

  /** Troca processo e saída; existe para os testes não encerrarem o jest. */
  bindTo(target: NodeJS.Process, exit: ExitFn): this {
    this.target = target;
    this.exit = exit;
    return this;
  }

  onApplicationBootstrap(): void {
    this.target.on('unhandledRejection', this.onRejection);
    this.target.on('uncaughtException', this.onException);
  }

  onApplicationShutdown(): void {
    this.target.off('unhandledRejection', this.onRejection);
    this.target.off('uncaughtException', this.onException);
  }

  private async flushAndExit(): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        this.technicalLog.flush(),
        new Promise<void>((done) => {
          timer = setTimeout(done, PROCESS_FLUSH_TIMEOUT_MS);
        }),
      ]);
    } catch (error: unknown) {
      emergencyWrite(ProcessErrorListenersService.name, 'flush falhou', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      if (timer) clearTimeout(timer);
      this.exit(1);
    }
  }
}
