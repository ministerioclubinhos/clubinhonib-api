import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import {
  LogRecordType,
  LogStorageKind,
} from 'src/shared/providers/log-storage/enums';
import {
  AuditStoragePort,
  ObservabilityStoragePort,
} from 'src/shared/providers/log-storage/ports/log-storage.port';
import { QueryableRecordType } from 'src/shared/providers/log-storage/types';

import { DeleteLogRecordsResponseDto } from '../dto/delete-log-record.dto';
import { assertQueryable, validateRange } from '../utils';

/**
 * Exclusão administrativa de registros (item ou intervalo).
 *
 * Existe a pedido do solicitante (2026-09-05), revendo a decisão inicial de
 * não haver rota de exclusão. A própria chamada `DELETE` é auditada pelo
 * interceptor global, então apagar deixa rastro: quem, quando, qual `eventId`
 * ou qual intervalo.
 */
@Injectable()
export class DeleteLogRecordsService {
  constructor(
    private readonly observability: ObservabilityStoragePort,
    private readonly audit: AuditStoragePort,
  ) {}

  deleteObservability(
    eventId: string,
    occurredAt: string,
  ): Promise<DeleteLogRecordsResponseDto> {
    return this.deleteOne(LogRecordType.Observability, eventId, occurredAt);
  }

  deleteAudit(
    eventId: string,
    occurredAt: string,
  ): Promise<DeleteLogRecordsResponseDto> {
    return this.deleteOne(LogRecordType.Audit, eventId, occurredAt);
  }

  deleteObservabilityRange(
    from: string,
    to: string,
  ): Promise<DeleteLogRecordsResponseDto> {
    return this.deleteRange(LogRecordType.Observability, from, to);
  }

  deleteAuditRange(
    from: string,
    to: string,
  ): Promise<DeleteLogRecordsResponseDto> {
    return this.deleteRange(LogRecordType.Audit, from, to);
  }

  private storageOf(recordType: QueryableRecordType) {
    return recordType === LogRecordType.Audit ? this.audit : this.observability;
  }

  private async deleteOne(
    recordType: QueryableRecordType,
    eventId: string,
    occurredAt: string,
  ): Promise<DeleteLogRecordsResponseDto> {
    const storage = this.storageOf(recordType);
    assertQueryable(storage, LogStorageKind.File);
    const instant = new Date(occurredAt);
    if (Number.isNaN(instant.getTime())) {
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Registro não encontrado',
      );
    }
    const removed = await storage.delete({
      recordType,
      eventId,
      occurredAt: instant.toISOString(),
    });
    if (!removed) {
      throw new AppNotFoundException(
        ErrorCode.RESOURCE_NOT_FOUND,
        'Registro não encontrado',
        { eventId },
      );
    }
    return { deleted: 1 };
  }

  private async deleteRange(
    recordType: QueryableRecordType,
    from: string,
    to: string,
  ): Promise<DeleteLogRecordsResponseDto> {
    const storage = this.storageOf(recordType);
    assertQueryable(storage, LogStorageKind.File);
    const range = validateRange(from, to);
    const deleted = await storage.deleteRange({
      recordType,
      from: range.from,
      to: range.to,
    });
    return { deleted };
  }
}
