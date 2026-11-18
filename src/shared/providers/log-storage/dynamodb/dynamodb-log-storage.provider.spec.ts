import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import {
  LogActorType,
  LogRecordType,
  LogSourceType,
  LogStorageKind,
  LogStream,
} from '../enums';
import { LogRecord, LogWriteError, LogWriteFailureKind } from '../types';
import { DynamoDbLogStorage } from './dynamodb-log-storage.provider';

type Sent = { name: string; input: Record<string, unknown> };

const conditional = () =>
  Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' });

const record = (overrides: Partial<LogRecord> = {}): LogRecord => ({
  schemaVersion: '1',
  eventId: 'evt-1',
  recordType: LogRecordType.Audit,
  environment: 'test',
  service: 'clubinhonib-api',
  occurredAt: '2026-09-05T10:00:00.000Z',
  expiresAtEpochSeconds: 2_000_000_000,
  requestId: 'req-1',
  sourceType: LogSourceType.Http,
  actorType: LogActorType.User,
  actorId: 'user-1',
  actorRole: null,
  ...overrides,
});

describe('DynamoDbLogStorage', () => {
  const sent: Sent[] = [];
  let responses: unknown[];
  const client = {
    send: jest.fn(
      (command: {
        constructor: { name: string };
        input: Record<string, unknown>;
      }) => {
        sent.push({ name: command.constructor.name, input: command.input });
        const next = responses.shift();
        return next instanceof Error
          ? Promise.reject(next)
          : Promise.resolve(next ?? {});
      },
    ),
  } as unknown as DynamoDBDocumentClient;
  const emergency = jest.fn();
  const storage = new DynamoDbLogStorage(
    client,
    {
      kind: LogStorageKind.DynamoDb,
      tableName: 'logs',
      region: 'us-east-1',
      endpoint: null,
    },
    LogStream.Audit,
    () => new Date('2026-09-05T12:00:00Z'),
    emergency,
  );

  beforeEach(() => {
    sent.length = 0;
    responses = [];
    emergency.mockClear();
  });

  it('grava com chaves derivadas, GSI esparso e condição contra sobrescrita', async () => {
    await storage.write(record());

    expect(sent).toHaveLength(1);
    expect(sent[0].name).toBe(PutCommand.name);
    expect(sent[0].input).toMatchObject({
      TableName: 'logs',
      ConditionExpression: 'attribute_not_exists(pk)',
      Item: {
        pk: 'STREAM#audit#DAY#2026-09-05',
        sk: '2026-09-05T10:00:00.000Z#evt-1',
        gsi1pk: 'REQUEST#req-1',
        gsi1sk: '2026-09-05T10:00:00.000Z#audit#evt-1',
        expiresAtEpochSeconds: 2_000_000_000,
      },
    });
  });

  it('sem requestId não preenche o índice', async () => {
    await storage.write(record({ requestId: null }));
    expect(
      (sent[0].input.Item as Record<string, unknown>).gsi1pk,
    ).toBeUndefined();
  });

  it('escrita repetida (retry após timeout) é tratada como sucesso', async () => {
    responses = [conditional()];
    await expect(storage.write(record())).resolves.toBeUndefined();
  });

  it('classifica throttling como transitório e validação como permanente', async () => {
    responses = [
      Object.assign(new Error('t'), {
        name: 'ProvisionedThroughputExceededException',
      }),
    ];
    await expect(storage.write(record())).rejects.toMatchObject({
      kind: LogWriteFailureKind.Transient,
    });

    responses = [
      Object.assign(new Error('v'), { name: 'ValidationException' }),
    ];
    await expect(storage.write(record())).rejects.toMatchObject({
      kind: LogWriteFailureKind.Permanent,
    });
  });

  it('item grande é recusado localmente sem chamar o serviço', async () => {
    await expect(
      storage.write(record({ message: 'x'.repeat(70_000) })),
    ).rejects.toBeInstanceOf(LogWriteError);
    expect(sent).toHaveLength(0);
  });

  it('repetição vira contador no primeiro evento; sem ele, vira item próprio', async () => {
    const repeat = record({
      eventId: 'evt-2',
      recordType: LogRecordType.AuditRepeat,
      occurredAt: '2026-09-05T10:00:30.000Z',
      repeatsEventId: 'evt-1',
      repeatsOccurredAt: '2026-09-05T10:00:00.000Z',
    });

    await storage.write(repeat);
    expect(sent[0].name).toBe(UpdateCommand.name);
    expect(sent[0].input).toMatchObject({
      Key: {
        pk: 'STREAM#audit#DAY#2026-09-05',
        sk: '2026-09-05T10:00:00.000Z#evt-1',
      },
      UpdateExpression:
        'ADD occurrenceCount :one SET lastOccurredAt = :occurredAt',
      ConditionExpression: 'attribute_exists(pk)',
    });

    sent.length = 0;
    responses = [conditional()];
    await storage.write(repeat);
    expect(sent.map((s) => s.name)).toEqual([
      UpdateCommand.name,
      PutCommand.name,
    ]);
  });

  it('claimDedup abre a janela com condição e, se já aberta, lê o primeiro evento', async () => {
    const input = {
      fingerprint: 'fp',
      eventId: 'evt-9',
      occurredAt: '2026-09-05T12:00:00.000Z',
      windowSeconds: 60,
      expiresAtEpochSeconds: 2_000_000_000,
    };

    expect(await storage.claimDedup(input)).toEqual({
      fingerprint: 'fp',
      duplicateOf: null,
    });
    expect(sent[0].input).toMatchObject({
      Item: {
        pk: 'DEDUP#fp',
        sk: 'DEDUP',
        recordType: 'audit_dedup',
        firstEventId: 'evt-9',
      },
      ConditionExpression:
        'attribute_not_exists(pk) OR windowEndsAtEpochMs < :now',
    });

    sent.length = 0;
    responses = [
      conditional(),
      {
        Item: {
          firstEventId: 'evt-1',
          firstOccurredAt: '2026-09-05T11:59:50.000Z',
        },
      },
    ];
    expect(await storage.claimDedup(input)).toEqual({
      fingerprint: 'fp',
      duplicateOf: { eventId: 'evt-1', occurredAt: '2026-09-05T11:59:50.000Z' },
    });
    expect(sent.map((s) => s.name)).toEqual([PutCommand.name, GetCommand.name]);
  });

  it('claimDedup indisponível falha aberto: o evento não é considerado repetido', async () => {
    responses = [
      Object.assign(new Error('down'), { name: 'ServiceUnavailable' }),
    ];
    const claim = await storage.claimDedup({
      fingerprint: 'fp',
      eventId: 'e',
      occurredAt: '2026-09-05T12:00:00.000Z',
      windowSeconds: 60,
      expiresAtEpochSeconds: 1,
    });
    expect(claim.duplicateOf).toBeNull();
    expect(emergency).toHaveBeenCalled();
  });

  it('consulta por dias: conta cada partição com os filtros e lê só as que contêm a página pedida', async () => {
    // Dois dias: 05 (mais recente) com 3 itens filtrados e 04 com 2.
    // Página 2 de tamanho 2 = 3º item do dia 05 + 1º do dia 04.
    (client.send as jest.Mock).mockImplementation(
      (command: { input: Record<string, unknown> }) => {
        sent.push({ name: QueryCommand.name, input: command.input });
        const values = command.input.ExpressionAttributeValues as Record<
          string,
          string
        >;
        const day = values[':pk'].endsWith('2026-09-05') ? '05' : '04';
        if (command.input.Select === 'COUNT') {
          return Promise.resolve({ Count: day === '05' ? 3 : 2 });
        }
        return Promise.resolve({
          Items:
            day === '05'
              ? [
                  { pk: 'p', sk: 's', eventId: 'd5-a' },
                  { pk: 'p', sk: 's', eventId: 'd5-b' },
                  { pk: 'p', sk: 's', eventId: 'd5-c' },
                ]
              : [
                  { pk: 'p', sk: 's', eventId: 'd4-a' },
                  { pk: 'p', sk: 's', eventId: 'd4-b' },
                ],
        });
      },
    );

    const page = await storage.query({
      recordType: LogRecordType.Audit,
      from: new Date('2026-09-04T00:00:00Z'),
      to: new Date('2026-09-05T23:00:00Z'),
      page: 2,
      limit: 2,
      requestId: null,
      filters: { outcome: 'failed' },
      contains: { actorNameSearch: 'maria' },
    });

    expect(page).toMatchObject({ total: 5, page: 2, limit: 2 });
    expect(page.items.map((i) => i.eventId)).toEqual(['d5-c', 'd4-a']);
    expect(page.items[0]).not.toHaveProperty('pk');

    const counts = sent.filter((s) => s.input.Select === 'COUNT');
    const reads = sent.filter((s) => s.input.Select !== 'COUNT');
    expect(
      counts.map(
        (s) =>
          (s.input.ExpressionAttributeValues as Record<string, string>)[':pk'],
      ),
    ).toEqual(['STREAM#audit#DAY#2026-09-05', 'STREAM#audit#DAY#2026-09-04']);
    expect(reads).toHaveLength(2);
    expect(counts[0].input).toMatchObject({
      FilterExpression: '#ttl > :now AND #f0 = :f0 AND contains(#c0, :c0)',
      ScanIndexForward: false,
    });
    expect(counts[0].input.ExpressionAttributeValues).toMatchObject({
      ':f0': 'failed',
    });
    (client.send as jest.Mock).mockReset();
    (client.send as jest.Mock).mockImplementation(
      (command: {
        constructor: { name: string };
        input: Record<string, unknown>;
      }) => {
        sent.push({ name: command.constructor.name, input: command.input });
        const next = responses.shift();
        return next instanceof Error
          ? Promise.reject(next)
          : Promise.resolve(next ?? {});
      },
    );
  });

  it('página além do fim devolve vazio com o total, sem ler partições', async () => {
    responses = [{ Count: 1 }];
    const page = await storage.query({
      recordType: LogRecordType.Audit,
      from: new Date('2026-09-05T00:00:00Z'),
      to: new Date('2026-09-05T23:00:00Z'),
      page: 3,
      limit: 10,
      requestId: null,
      filters: {},
    });
    expect(page).toEqual({ items: [], total: 1, page: 3, limit: 10 });
    expect(sent).toHaveLength(1);
  });

  it('consulta por requestId usa o índice esparso, filtra o tipo e pula os itens das páginas anteriores', async () => {
    responses = [
      { Count: 3 },
      {
        Items: [
          { eventId: 'x', gsi1pk: 'g' },
          { eventId: 'y' },
          { eventId: 'z' },
        ],
      },
    ];
    const page = await storage.query({
      recordType: LogRecordType.Observability,
      from: new Date('2026-09-05T00:00:00Z'),
      to: new Date('2026-09-05T23:00:00Z'),
      page: 2,
      limit: 2,
      requestId: 'req-1',
      filters: {},
    });
    expect(page.items).toEqual([{ eventId: 'z' }]);
    expect(page.total).toBe(3);
    expect(sent[0].input).toMatchObject({
      IndexName: 'gsi1-request',
      Select: 'COUNT',
    });
    expect(sent[1].input).toMatchObject({ IndexName: 'gsi1-request' });
    expect(sent[1].input.ExpressionAttributeValues).toMatchObject({
      ':gpk': 'REQUEST#req-1',
      ':rt': 'observability',
    });
  });

  it('apaga um item pela chave derivada e diz se ele existia', async () => {
    responses = [{ Attributes: { eventId: 'evt-1' } }, {}];
    const reference = {
      recordType: LogRecordType.Audit as const,
      eventId: 'evt-1',
      occurredAt: '2026-09-05T10:00:00.000Z',
    };
    expect(await storage.delete(reference)).toBe(true);
    expect(await storage.delete(reference)).toBe(false);
    expect(sent[0].name).toBe(DeleteCommand.name);
    expect(sent[0].input).toMatchObject({
      Key: {
        pk: 'STREAM#audit#DAY#2026-09-05',
        sk: '2026-09-05T10:00:00.000Z#evt-1',
      },
      ReturnValues: 'ALL_OLD',
    });
  });

  it('apaga um intervalo: lista as chaves de audit e audit_repeat e remove em lote, repetindo o não processado', async () => {
    const key = (n: number) => ({
      pk: 'STREAM#audit#DAY#2026-09-05',
      sk: `s${n}`,
    });
    responses = [
      // audit / 2026-09-05: 26 chaves em duas páginas
      {
        Items: Array.from({ length: 20 }, (_, i) => key(i)),
        LastEvaluatedKey: key(19),
      },
      { Items: Array.from({ length: 6 }, (_, i) => key(20 + i)) },
      // lote 1 (25) com um não processado, depois o retry do não processado
      { UnprocessedItems: { logs: [{ DeleteRequest: { Key: key(3) } }] } },
      {},
      // lote 2 (1)
      {},
      // audit_repeat / 2026-09-05: vazio
      { Items: [] },
    ];

    const removed = await storage.deleteRange({
      recordType: LogRecordType.Audit,
      from: new Date('2026-09-05T00:00:00Z'),
      to: new Date('2026-09-05T23:00:00Z'),
    });

    expect(removed).toBe(26);
    const names = sent.map((s) => s.name);
    expect(names).toEqual([
      QueryCommand.name,
      QueryCommand.name,
      BatchWriteCommand.name,
      BatchWriteCommand.name,
      BatchWriteCommand.name,
      QueryCommand.name,
    ]);
    expect(sent[0].input).toMatchObject({ ProjectionExpression: '#pk, #sk' });
    expect(
      (sent[0].input.ExpressionAttributeValues as Record<string, string>)[
        ':pk'
      ],
    ).toBe('STREAM#audit#DAY#2026-09-05');
    expect(
      (sent[5].input.ExpressionAttributeValues as Record<string, string>)[
        ':pk'
      ],
    ).toBe('STREAM#audit_repeat#DAY#2026-09-05');
    const firstBatch = (sent[2].input.RequestItems as Record<string, unknown[]>)
      .logs;
    expect(firstBatch).toHaveLength(25);
    const retryBatch = (sent[3].input.RequestItems as Record<string, unknown[]>)
      .logs;
    expect(retryBatch).toEqual([{ DeleteRequest: { Key: key(3) } }]);
  });

  it('erro na consulta é classificado', async () => {
    responses = [
      Object.assign(new Error('x'), { name: 'AccessDeniedException' }),
    ];
    await expect(
      storage.query({
        recordType: LogRecordType.Audit,
        from: new Date('2026-09-05T00:00:00Z'),
        to: new Date('2026-09-05T23:00:00Z'),
        page: 1,
        limit: 1,
        requestId: null,
        filters: {},
      }),
    ).rejects.toMatchObject({ kind: LogWriteFailureKind.Permanent });
  });
});
