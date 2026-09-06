import { AppValidationException } from 'src/shared/exceptions';
import { LogRecordType } from 'src/shared/providers/log-storage/enums';
import {
  AuditStoragePort,
  ObservabilityStoragePort,
} from 'src/shared/providers/log-storage/ports/log-storage.port';

import { GetLogRecordsService } from './get-log-records.service';

describe('GetLogRecordsService', () => {
  it('com storage file responde LOG_9101 sem consultar', async () => {
    const query = jest.fn();
    const fileService = new GetLogRecordsService(
      { queryable: false, query } as unknown as ObservabilityStoragePort,
      { queryable: false, query } as unknown as AuditStoragePort,
    );
    await expect(
      fileService.listAudit({
        from: '2026-09-04T00:00:00Z',
        to: '2026-09-05T00:00:00Z',
      }),
    ).rejects.toMatchObject({ code: 'LOG_9101' });
    expect(query).not.toHaveBeenCalled();
  });

  const observabilityQuery = jest
    .fn()
    .mockResolvedValue({ items: [], total: 40, page: 2, limit: 10 });
  const auditQuery = jest
    .fn()
    .mockResolvedValue({ items: [], total: 0, page: 1, limit: 25 });
  const service = new GetLogRecordsService(
    {
      queryable: true,
      query: observabilityQuery,
    } as unknown as ObservabilityStoragePort,
    { queryable: true, query: auditQuery } as unknown as AuditStoragePort,
  );

  it('monta a consulta técnica com filtros allowlisted e repassa o cursor', async () => {
    const page = await service.listObservability({
      from: '2026-09-04T00:00:00Z',
      to: '2026-09-05T00:00:00Z',
      page: 2,
      limit: 10,
      requestId: 'r1',
      level: 'error' as never,
      errorCode: 'INT_9001',
    });

    expect(page).toEqual({
      data: [],
      total: 40,
      page: 2,
      limit: 10,
      pageCount: 4,
    });
    expect(observabilityQuery).toHaveBeenCalledWith({
      recordType: LogRecordType.Observability,
      from: new Date('2026-09-04T00:00:00Z'),
      to: new Date('2026-09-05T00:00:00Z'),
      page: 2,
      limit: 10,
      requestId: 'r1',
      filters: { level: 'error', errorCode: 'INT_9001' },
    });
  });

  it('auditoria usa o limite padrão e recusa intervalo inválido antes do storage', async () => {
    await service.listAudit({
      from: '2026-09-04T00:00:00Z',
      to: '2026-09-05T00:00:00Z',
      outcome: 'failed' as never,
    });
    expect(auditQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        recordType: LogRecordType.Audit,
        page: 1,
        limit: 25,
        filters: { outcome: 'failed' },
      }),
    );

    auditQuery.mockClear();
    await expect(
      service.listAudit({
        from: '2026-09-05T00:00:00Z',
        to: '2026-09-04T00:00:00Z',
      }),
    ).rejects.toBeInstanceOf(AppValidationException);
    expect(auditQuery).not.toHaveBeenCalled();
  });
});
