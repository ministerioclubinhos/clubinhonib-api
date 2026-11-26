import { Global, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

import { GlobalExceptionFilter } from 'src/shared/exceptions/filters/global-exception.filter';

import { AutomaticActionContextGuard } from './guards/automatic-action-context.guard';
import { AuditInterceptor } from './interceptors/audit.interceptor';
import { ActionBoundaryService } from './services/action-boundary.service';
import { AuditDeduplicationService } from './services/audit-deduplication.service';
import { WriteAuditEventService } from './services/write-audit-event.service';

/**
 * Auditoria transversal de todas as ações.
 *
 * Um guard de descoberta, um interceptor de sucesso e um filtro de falha
 * cobrem o boundary HTTP inteiro — inclusive controllers futuros — sem
 * decorator nem chamada manual. O filtro global passa a ser registrado aqui
 * por `APP_FILTER` para receber os serviços por injeção; `main.ts` não o
 * instancia mais.
 */
@Global()
@Module({
  providers: [
    AuditDeduplicationService,
    WriteAuditEventService,
    ActionBoundaryService,
    { provide: APP_GUARD, useClass: AutomaticActionContextGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
  ],
  exports: [WriteAuditEventService, ActionBoundaryService],
})
export class AuditModule {}
