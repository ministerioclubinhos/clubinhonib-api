import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import { Paginated } from 'src/shared/dto/paginated.dto';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from '../auth/guards/role-guard';

import {
  LOG_RECORDS_AUDIT_ITEM_PATH,
  LOG_RECORDS_AUDIT_PATH,
  LOG_RECORDS_EVENT_PARAM,
  LOG_RECORDS_OBSERVABILITY_ITEM_PATH,
  LOG_RECORDS_OBSERVABILITY_PATH,
  LOG_RECORDS_ROUTE,
} from './constants';
import { AuditRecordResponseDto } from './dto/audit-record-response.dto';
import {
  DeleteLogRecordQueryDto,
  DeleteLogRecordsRangeDto,
  DeleteLogRecordsResponseDto,
} from './dto/delete-log-record.dto';
import { ObservabilityRecordResponseDto } from './dto/observability-record-response.dto';
import { QueryAuditRecordsDto } from './dto/query-audit-records.dto';
import { QueryObservabilityRecordsDto } from './dto/query-observability-records.dto';
import { DeleteLogRecordsService } from './services/delete-log-records.service';
import { GetLogRecordsService } from './services/get-log-records.service';

/**
 * Consulta e exclusão administrativa dos registros técnicos e de auditoria
 * (D-008).
 *
 * Somente administrador. Paginação por `page`/`limit` com `total` e
 * `pageCount`, como as demais listagens da API. As rotas `DELETE` apagam um
 * item ou um intervalo; a chamada em si fica na auditoria.
 */
@Controller(LOG_RECORDS_ROUTE)
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class LogRecordsController {
  constructor(
    private readonly getService: GetLogRecordsService,
    private readonly deleteService: DeleteLogRecordsService,
  ) {}

  @Get(LOG_RECORDS_OBSERVABILITY_PATH)
  listObservability(
    @Query() query: QueryObservabilityRecordsDto,
  ): Promise<Paginated<ObservabilityRecordResponseDto>> {
    return this.getService.listObservability(query);
  }

  @Get(LOG_RECORDS_AUDIT_PATH)
  listAudit(
    @Query() query: QueryAuditRecordsDto,
  ): Promise<Paginated<AuditRecordResponseDto>> {
    return this.getService.listAudit(query);
  }

  @Delete(LOG_RECORDS_OBSERVABILITY_ITEM_PATH)
  deleteObservability(
    @Param(LOG_RECORDS_EVENT_PARAM, new ParseUUIDPipe()) eventId: string,
    @Query() query: DeleteLogRecordQueryDto,
  ): Promise<DeleteLogRecordsResponseDto> {
    return this.deleteService.deleteObservability(eventId, query.occurredAt);
  }

  @Delete(LOG_RECORDS_AUDIT_ITEM_PATH)
  deleteAudit(
    @Param(LOG_RECORDS_EVENT_PARAM, new ParseUUIDPipe()) eventId: string,
    @Query() query: DeleteLogRecordQueryDto,
  ): Promise<DeleteLogRecordsResponseDto> {
    return this.deleteService.deleteAudit(eventId, query.occurredAt);
  }

  @Delete(LOG_RECORDS_OBSERVABILITY_PATH)
  deleteObservabilityRange(
    @Query() query: DeleteLogRecordsRangeDto,
  ): Promise<DeleteLogRecordsResponseDto> {
    return this.deleteService.deleteObservabilityRange(query.from, query.to);
  }

  @Delete(LOG_RECORDS_AUDIT_PATH)
  deleteAuditRange(
    @Query() query: DeleteLogRecordsRangeDto,
  ): Promise<DeleteLogRecordsResponseDto> {
    return this.deleteService.deleteAuditRange(query.from, query.to);
  }
}
