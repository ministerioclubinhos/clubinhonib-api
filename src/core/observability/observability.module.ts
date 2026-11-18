import { Global, Module } from '@nestjs/common';

import { ProcessErrorListenersService } from './process/process-error-listeners.service';
import { StructuredLoggerService } from './providers/structured-logger.service';
import { WriteTechnicalLogService } from './services/write-technical-log.service';

/**
 * Observabilidade técnica: logger estruturado, escrita de registros e
 * listeners de processo.
 *
 * `main.ts` instala o `StructuredLoggerService` com `app.useLogger`, o que
 * cobre todo `Logger` da aplicação sem alterar módulo por módulo.
 */
@Global()
@Module({
  providers: [
    WriteTechnicalLogService,
    StructuredLoggerService,
    ProcessErrorListenersService,
  ],
  exports: [WriteTechnicalLogService, StructuredLoggerService],
})
export class ObservabilityModule {}
