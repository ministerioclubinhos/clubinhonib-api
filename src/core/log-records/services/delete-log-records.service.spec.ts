import {
  AppNotFoundException,
  AppValidationException,
} from 'src/shared/exceptions';
import { LogRecordType } from 'src/shared/providers/log-storage/enums';
import {
  AuditStoragePort,
  ObservabilityStoragePort,
} from 'src/shared/providers/log-storage/ports/log-storage.port';

import { DeleteLogRecordsService } from './delete-log-records.service';

describe('DeleteLogRecordsService', () => {
  const obsDelete = jest.fn();
  const obsDeleteRange = jest.fn();
  const auditDelete = jest.fn();
  const auditDeleteRange = jest.fn();
  const service = new DeleteLogRecordsService(
    {
      queryable: true,
      delete: obsDelete,
      deleteRange: obsDeleteRange,
    } as unknown as ObservabilityStoragePort,
    {
      queryable: true,
      delete: auditDelete,
      deleteRange: auditDeleteRange,
    } as unknown as AuditStoragePort,
  );

  beforeEach(() => {
    obsDelete.mockReset();
    obsDeleteRange.mockReset();
    auditDelete.mockReset();
    auditDeleteRange.mockReset();
  });

  it('com storage file responde LOG_9101 sem apagar', async () => {
    const fileService = new DeleteLogRecordsService(
      {
        queryable: false,
        delete: obsDelete,
      } as unknown as ObservabilityStoragePort,
      { queryable: false, delete: auditDelete } as unknown as AuditStoragePort,
    );
    await expect(
      fileService.deleteAudit('evt-1', '2026-09-05T10:00:00Z'),
    ).rejects.toMatchObject({ code: 'LOG_9101' });
    expect(auditDelete).not.toHaveBeenCalled();
  });

  it('apaga um item do fluxo certo, normalizando o instante', async () => {
    auditDelete.mockResolvedValue(true);
    await expect(
      service.deleteAudit('evt-1', '2026-09-05T10:00:00Z'),
    ).resolves.toEqual({ deleted: 1 });
    expect(auditDelete).toHaveBeenCalledWith({
      recordType: LogRecordType.Audit,
      eventId: 'evt-1',
      occurredAt: '2026-09-05T10:00:00.000Z',
    });
    expect(obsDelete).not.toHaveBeenCalled();
  });

  it('item inexistente ou instante inválido é 404', async () => {
    obsDelete.mockResolvedValue(false);
    await expect(
      service.deleteObservability('evt-1', '2026-09-05T10:00:00Z'),
    ).rejects.toBeInstanceOf(AppNotFoundException);
    await expect(
      service.deleteObservability('evt-1', 'ontem'),
    ).rejects.toBeInstanceOf(AppNotFoundException);
    expect(obsDelete).toHaveBeenCalledTimes(1);
  });

  it('intervalo valida antes de apagar e devolve a contagem', async () => {
    obsDeleteRange.mockResolvedValue(12);
    await expect(
      service.deleteObservabilityRange(
        '2026-09-04T00:00:00Z',
        '2026-09-05T00:00:00Z',
      ),
    ).resolves.toEqual({ deleted: 12 });
    expect(obsDeleteRange).toHaveBeenCalledWith({
      recordType: LogRecordType.Observability,
      from: new Date('2026-09-04T00:00:00Z'),
      to: new Date('2026-09-05T00:00:00Z'),
    });

    await expect(
      service.deleteAuditRange('2026-09-05T00:00:00Z', '2026-09-04T00:00:00Z'),
    ).rejects.toBeInstanceOf(AppValidationException);
    expect(auditDeleteRange).not.toHaveBeenCalled();
  });
});
