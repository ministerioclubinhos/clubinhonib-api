import { Injectable } from '@nestjs/common';

import { actorNameSearchKey } from 'src/core/request-context/utils';

import { LogStorageKind } from 'src/shared/providers/log-storage/enums';

import { LogRecordType } from 'src/shared/providers/log-storage/enums';
import {
  AuditStoragePort,
  ObservabilityStoragePort,
} from 'src/shared/providers/log-storage/ports/log-storage.port';

import { Paginated } from 'src/shared/dto/paginated.dto';

import {
  AUDIT_CONTAINS_FIELDS,
  AUDIT_FILTER_FIELDS,
  LOG_RECORDS_DEFAULT_LIMIT,
  LOG_RECORDS_DEFAULT_PAGE,
  OBSERVABILITY_FILTER_FIELDS,
} from '../constants';
import { AuditRecordResponseDto } from '../dto/audit-record-response.dto';
import { ObservabilityRecordResponseDto } from '../dto/observability-record-response.dto';
import { QueryAuditRecordsDto } from '../dto/query-audit-records.dto';
import { QueryObservabilityRecordsDto } from '../dto/query-observability-records.dto';
import { toAuditResponse, toObservabilityResponse } from '../mappers';
import { assertQueryable, pickFilters, validateRange } from '../utils';

/**
 * Consulta somente leitura dos dois fluxos.
 *
 * Separada dos serviços de escrita: nada aqui grava, altera ou apaga. A
 * própria chamada é auditada como qualquer `GET` — e isso não recursa, porque
 * gravar auditoria não consulta nada.
 */
@Injectable()
export class GetLogRecordsService {
  constructor(
    private readonly observability: ObservabilityStoragePort,
    private readonly audit: AuditStoragePort,
  ) {}

  async listObservability(
    query: QueryObservabilityRecordsDto,
  ): Promise<Paginated<ObservabilityRecordResponseDto>> {
    assertQueryable(this.observability, LogStorageKind.File);
    const range = validateRange(query.from, query.to);
    const page = await this.observability.query({
      recordType: LogRecordType.Observability,
      from: range.from,
      to: range.to,
      page: query.page ?? LOG_RECORDS_DEFAULT_PAGE,
      limit: query.limit ?? LOG_RECORDS_DEFAULT_LIMIT,
      requestId: query.requestId ?? null,
      filters: pickFilters(query, OBSERVABILITY_FILTER_FIELDS),
    });
    return new Paginated(
      page.items.map(toObservabilityResponse),
      page.total,
      page.page,
      page.limit,
    );
  }

  async listAudit(
    query: QueryAuditRecordsDto,
  ): Promise<Paginated<AuditRecordResponseDto>> {
    assertQueryable(this.audit, LogStorageKind.File);
    const range = validateRange(query.from, query.to);
    const page = await this.audit.query({
      recordType: LogRecordType.Audit,
      from: range.from,
      to: range.to,
      page: query.page ?? LOG_RECORDS_DEFAULT_PAGE,
      limit: query.limit ?? LOG_RECORDS_DEFAULT_LIMIT,
      requestId: query.requestId ?? null,
      filters: pickFilters(query, AUDIT_FILTER_FIELDS),
      contains: {
        ...pickFilters(query, AUDIT_CONTAINS_FIELDS),
        ...(query.actorName?.trim()
          ? { actorNameSearch: actorNameSearchKey(query.actorName) }
          : {}),
      },
    });
    return new Paginated(
      page.items.map(toAuditResponse),
      page.total,
      page.page,
      page.limit,
    );
  }
}
