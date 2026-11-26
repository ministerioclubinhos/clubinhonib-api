import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  LogActorType,
  LogRecordType,
  LogSourceType,
  LogStorageKind,
  LogStream,
} from '../enums';
import { LogRecord, LogWriteError } from '../types';
import { FileLogStorage } from './file-log-storage.provider';

const at = (iso: string) => new Date(iso);

const record = (overrides: Partial<LogRecord> = {}): LogRecord => ({
  schemaVersion: '1',
  eventId: overrides.eventId ?? `evt-${Math.random().toString(36).slice(2)}`,
  recordType: LogRecordType.Audit,
  environment: 'test',
  service: 'clubinhonib-api',
  occurredAt: '2026-09-05T10:00:00.000Z',
  expiresAtEpochSeconds: Math.floor(
    at('2026-09-06T10:00:00Z').getTime() / 1000,
  ),
  requestId: null,
  sourceType: LogSourceType.Http,
  actorType: LogActorType.Anonymous,
  actorId: null,
  actorRole: null,
  ...overrides,
});

describe('FileLogStorage', () => {
  let root: string;
  let storage: FileLogStorage;
  let now: Date;
  const emergency = jest.fn();

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'clubinho-logs-'));
    now = at('2026-09-05T12:00:00Z');
    storage = new FileLogStorage(
      { kind: LogStorageKind.File, directory: join(root, 'audit') },
      LogStream.Audit,
      1,
      () => now,
      emergency,
      4242,
    );
    emergency.mockClear();
  });

  afterEach(async () => {
    await storage.close();
    rmSync(root, { recursive: true, force: true });
  });

  it('grava JSONL válido, uma linha por registro, no arquivo do dia UTC e do processo', async () => {
    await storage.write(record({ eventId: 'a' }));
    await storage.write(
      record({ eventId: 'b', occurredAt: '2026-09-05T23:59:59.000Z' }),
    );
    await storage.write(
      record({ eventId: 'c', occurredAt: '2026-09-06T00:00:01.000Z' }),
    );

    const files = readdirSync(join(root, 'audit')).sort();
    expect(files).toEqual(['2026-09-05.4242.jsonl', '2026-09-06.4242.jsonl']);

    const lines = readFileSync(join(root, 'audit', files[0]), 'utf8')
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as LogRecord);
    expect(lines.map((l) => l.eventId)).toEqual(['a', 'b']);
  });

  it('escritas concorrentes não se misturam', async () => {
    await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        storage.write(record({ eventId: `e${i}`, requestId: 'x'.repeat(500) })),
      ),
    );
    const content = readFileSync(
      join(root, 'audit', '2026-09-05.4242.jsonl'),
      'utf8',
    );
    const parsed = content
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as LogRecord);
    expect(parsed).toHaveLength(50);
  });

  it('consulta por intervalo, tipo, requestId e filtros, do mais recente ao mais antigo, paginando por página com total', async () => {
    await storage.write(
      record({
        eventId: 'old',
        occurredAt: '2026-09-04T09:00:00.000Z',
        requestId: 'r1',
      }),
    );
    await storage.write(
      record({
        eventId: 'mid',
        occurredAt: '2026-09-05T09:00:00.000Z',
        requestId: 'r2',
        outcome: 'failed',
      }),
    );
    await storage.write(
      record({
        eventId: 'new',
        occurredAt: '2026-09-05T11:00:00.000Z',
        requestId: 'r1',
        outcome: 'succeeded',
      }),
    );
    await storage.write(
      record({
        eventId: 'other-type',
        recordType: LogRecordType.Observability,
        occurredAt: '2026-09-05T11:30:00.000Z',
      }),
    );
    await storage.write(
      record({
        eventId: 'expired',
        occurredAt: '2026-09-05T11:40:00.000Z',
        expiresAtEpochSeconds: 1,
      }),
    );

    const base = {
      recordType: LogRecordType.Audit as const,
      from: at('2026-09-04T00:00:00Z'),
      to: at('2026-09-05T23:59:59Z'),
      page: 1,
      limit: 2,
      requestId: null,
      filters: {},
    };

    const first = await storage.query(base);
    expect(first.items.map((i) => i.eventId)).toEqual(['new', 'mid']);
    expect(first).toMatchObject({ total: 3, page: 1, limit: 2 });

    const second = await storage.query({ ...base, page: 2 });
    expect(second.items.map((i) => i.eventId)).toEqual(['old']);
    expect(second.total).toBe(3);

    const beyond = await storage.query({ ...base, page: 5 });
    expect(beyond.items).toEqual([]);
    expect(beyond.total).toBe(3);

    const byRequest = await storage.query({ ...base, requestId: 'r1' });
    expect(byRequest.items.map((i) => i.eventId)).toEqual(['new', 'old']);
    expect(byRequest.total).toBe(2);

    const byFilter = await storage.query({
      ...base,
      filters: { outcome: 'failed' },
    });
    expect(byFilter.items.map((i) => i.eventId)).toEqual(['mid']);
    expect(byFilter.total).toBe(1);
  });

  it('pula linha corrompida e sinaliza, sem derrubar a consulta', async () => {
    await storage.write(record({ eventId: 'ok' }));
    writeFileSync(join(root, 'audit', '2026-09-05.4242.jsonl'), '{"trunc', {
      flag: 'a',
    });

    const page = await storage.query({
      recordType: LogRecordType.Audit,
      from: at('2026-09-05T00:00:00Z'),
      to: at('2026-09-05T23:59:59Z'),
      page: 1,
      limit: 10,
      requestId: null,
      filters: {},
    });
    expect(page.items.map((i) => i.eventId)).toEqual(['ok']);
    expect(emergency).toHaveBeenCalledWith(
      'file-storage:audit',
      'linha inválida ignorada',
      expect.anything(),
    );
  });

  it('retenção apaga só arquivos do padrão mais antigos que o TTL', async () => {
    await storage.start();
    const dir = join(root, 'audit');
    writeFileSync(join(dir, '2026-09-03.1.jsonl'), '');
    writeFileSync(join(dir, '2026-09-04.1.jsonl'), '');
    writeFileSync(join(dir, '2026-09-05.1.jsonl'), '');
    writeFileSync(join(dir, 'notas.txt'), 'não sou do provider');

    await storage.runRetention();

    expect(readdirSync(dir).sort()).toEqual([
      '2026-09-04.1.jsonl',
      '2026-09-05.1.jsonl',
      'notas.txt',
    ]);
  });

  it('dedup por processo: abre a janela, repete dentro dela e reabre depois', async () => {
    const input = {
      fingerprint: 'fp',
      eventId: 'first',
      occurredAt: '2026-09-05T12:00:00.000Z',
      windowSeconds: 60,
      expiresAtEpochSeconds: 0,
    };
    expect((await storage.claimDedup(input)).duplicateOf).toBeNull();
    expect(
      (await storage.claimDedup({ ...input, eventId: 'second' })).duplicateOf,
    ).toEqual({
      eventId: 'first',
      occurredAt: input.occurredAt,
    });

    now = at('2026-09-05T12:01:01Z');
    expect(
      (await storage.claimDedup({ ...input, eventId: 'third' })).duplicateOf,
    ).toBeNull();
  });

  it('apaga um item pela chave natural e deixa o resto do arquivo intacto', async () => {
    await storage.write(record({ eventId: 'keep-1' }));
    await storage.write(record({ eventId: 'gone' }));
    await storage.write(record({ eventId: 'keep-2' }));

    expect(
      await storage.delete({
        recordType: LogRecordType.Audit,
        eventId: 'gone',
        occurredAt: '2026-09-05T10:00:00.000Z',
      }),
    ).toBe(true);
    expect(
      await storage.delete({
        recordType: LogRecordType.Audit,
        eventId: 'gone',
        occurredAt: '2026-09-05T10:00:00.000Z',
      }),
    ).toBe(false);

    const dir = join(root, 'audit');
    const lines = readFileSync(join(dir, '2026-09-05.4242.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as LogRecord).eventId);
    expect(lines).toEqual(['keep-1', 'keep-2']);
    expect(readdirSync(dir).some((name) => name.endsWith('.tmp'))).toBe(false);
  });

  it('apaga um intervalo do fluxo (com as repetições) e preserva outros tipos e instantes', async () => {
    await storage.write(
      record({ eventId: 'before', occurredAt: '2026-09-04T21:00:00.000Z' }),
    );
    await storage.write(
      record({ eventId: 'in-1', occurredAt: '2026-09-05T10:00:00.000Z' }),
    );
    await storage.write(
      record({
        eventId: 'repeat',
        recordType: LogRecordType.AuditRepeat,
        occurredAt: '2026-09-05T10:00:30.000Z',
      }),
    );
    await storage.write(
      record({
        eventId: 'other-type',
        recordType: LogRecordType.Observability,
        occurredAt: '2026-09-05T10:01:00.000Z',
      }),
    );
    await storage.write(
      record({ eventId: 'in-2', occurredAt: '2026-09-04T23:00:00.000Z' }),
    );
    await storage.write(
      record({ eventId: 'only-in', occurredAt: '2026-09-04T22:00:00.000Z' }),
    );

    const removed = await storage.deleteRange({
      recordType: LogRecordType.Audit,
      from: at('2026-09-04T22:00:00Z'),
      to: at('2026-09-05T11:00:00Z'),
    });

    expect(removed).toBe(4);
    const remaining = (
      await storage.query({
        recordType: LogRecordType.Audit,
        from: at('2026-09-04T00:00:00Z'),
        to: at('2026-09-05T23:59:59Z'),
        page: 1,
        limit: 10,
        requestId: null,
        filters: {},
      })
    ).items.map((i) => i.eventId);
    expect(remaining).toEqual(['before']);
    const dir = join(root, 'audit');
    expect(readdirSync(dir).sort()).toEqual([
      '2026-09-04.4242.jsonl',
      '2026-09-05.4242.jsonl',
    ]);
    const kept = readFileSync(join(dir, '2026-09-05.4242.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .map((line) => (JSON.parse(line) as LogRecord).eventId);
    expect(kept).toEqual(['other-type']);
  });

  it('registro grande é erro permanente', async () => {
    await expect(
      storage.write(record({ message: 'x'.repeat(70_000) })),
    ).rejects.toBeInstanceOf(LogWriteError);
  });
});
