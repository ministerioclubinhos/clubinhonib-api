import {
  BatchWriteCommand,
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
  QueryCommandOutput,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import {
  DYNAMO_DEDUP_PREFIX,
  DYNAMO_DEDUP_SK,
  DYNAMO_GSI1_NAME,
  DYNAMO_GSI1_PK,
  DYNAMO_GSI1_SK,
  DYNAMO_PK,
  DYNAMO_REQUEST_PREFIX,
  DYNAMO_SK,
  DYNAMO_STREAM_PREFIX,
  DYNAMO_BATCH_MAX_ATTEMPTS,
  DYNAMO_BATCH_SIZE,
  DYNAMO_TTL_ATTRIBUTE,
  LOG_RECORD_MAX_BYTES,
} from '../constants';
import { LogRecordType, LogStream } from '../enums';
import { LogRecordStorage } from '../ports/log-storage.port';
import {
  Clock,
  DedupClaim,
  DedupClaimInput,
  DedupReference,
  DynamoDbStorageConfig,
  EmergencySink,
  JsonValue,
  LogRecord,
  LogRecordPage,
  LogRecordQuery,
  LogRecordRange,
  LogRecordReference,
  LogWriteError,
  LogWriteFailureKind,
} from '../types';
import {
  describeError,
  physicalRecordTypes,
  utcDayOf,
  utcDaysBetweenDescending,
} from '../utils';

type DynamoKey = Record<string, JsonValue>;

/** Erros do serviço que valem uma nova tentativa. */
const TRANSIENT_ERROR_NAMES: ReadonlySet<string> = new Set([
  'ProvisionedThroughputExceededException',
  'ThrottlingException',
  'RequestLimitExceeded',
  'InternalServerError',
  'ServiceUnavailable',
  'TimeoutError',
  'NetworkingError',
  'ECONNRESET',
  'ETIMEDOUT',
]);

const CONDITIONAL_CHECK_FAILED = 'ConditionalCheckFailedException';

interface DedupItem {
  firstEventId?: unknown;
  firstOccurredAt?: unknown;
  windowEndsAtEpochMs?: unknown;
}

/**
 * Persistência dos dois fluxos em uma única tabela DynamoDB.
 *
 * ```text
 * PK = STREAM#<recordType>#DAY#<yyyy-mm-dd>     SK = <occurredAt>#<eventId>
 * GSI1PK = REQUEST#<requestId>                  GSI1SK = <occurredAt>#<recordType>#<eventId>
 * DEDUP: PK = DEDUP#<fingerprint>               SK = DEDUP
 * ```
 *
 * `expiresAtEpochSeconds` é o atributo de TTL; cada item carrega o seu, o que
 * permite retenções diferentes na mesma tabela. TTL é remoção eventual: a
 * consulta ignora o que já venceu e ainda não saiu.
 */
export class DynamoDbLogStorage implements LogRecordStorage {
  readonly queryable = true;

  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly config: DynamoDbStorageConfig,
    private readonly stream: LogStream,
    private readonly clock: Clock,
    private readonly emergency: EmergencySink,
  ) {}

  async write(record: LogRecord): Promise<void> {
    if (record.recordType === LogRecordType.AuditRepeat) {
      await this.writeRepeat(record);
      return;
    }
    await this.putRecord(record);
  }

  async claimDedup(input: DedupClaimInput): Promise<DedupClaim> {
    const now = this.clock().getTime();
    const key = this.dedupKey(input.fingerprint);
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.config.tableName,
          Item: {
            ...key,
            recordType: LogRecordType.AuditDedup,
            firstEventId: input.eventId,
            firstOccurredAt: input.occurredAt,
            windowEndsAtEpochMs: now + input.windowSeconds * 1000,
            [DYNAMO_TTL_ATTRIBUTE]: input.expiresAtEpochSeconds,
          },
          ConditionExpression: `attribute_not_exists(${DYNAMO_PK}) OR windowEndsAtEpochMs < :now`,
          ExpressionAttributeValues: { ':now': now },
        }),
      );
      return { fingerprint: input.fingerprint, duplicateOf: null };
    } catch (error: unknown) {
      if (errorName(error) !== CONDITIONAL_CHECK_FAILED) {
        // Falha aberta: em dúvida, o evento é gravado; perder auditoria por
        // causa da desduplicação seria inverter a prioridade.
        this.emergency(this.componentName(), 'dedup indisponível', {
          error: describeError(error),
        });
        return { fingerprint: input.fingerprint, duplicateOf: null };
      }
    }

    const existing = await this.readDedup(key);
    return { fingerprint: input.fingerprint, duplicateOf: existing };
  }

  /**
   * Página por offset com total.
   *
   * Cada dia UTC do intervalo é uma partição (ou uma só, no índice por
   * `requestId`). Primeiro conta cada partição (`Select: COUNT`, já com os
   * filtros), depois lê só as partições que contêm a página pedida, pulando o
   * que ficou antes dela. Custa proporcional ao offset, o que é aceitável para
   * uma consulta administrativa limitada a 31 dias.
   */
  async query(query: LogRecordQuery): Promise<LogRecordPage> {
    const partitions = query.requestId
      ? [this.requestPartitionInput(query, query.requestId)]
      : utcDaysBetweenDescending(query.from, query.to).map((day) =>
          this.dayPartitionInput(query, day),
        );

    const counts = await Promise.all(
      partitions.map((input) => this.countPartition(input)),
    );
    const total = counts.reduce((sum, count) => sum + count, 0);

    const items: LogRecord[] = [];
    let skip = (Math.max(1, query.page) - 1) * query.limit;
    for (let index = 0; index < partitions.length; index += 1) {
      if (items.length >= query.limit) break;
      if (skip >= counts[index]) {
        skip -= counts[index];
        continue;
      }
      items.push(
        ...(await this.readPartition(
          partitions[index],
          skip,
          query.limit - items.length,
        )),
      );
      skip = 0;
    }

    return { items, total, page: query.page, limit: query.limit };
  }

  async delete(reference: LogRecordReference): Promise<boolean> {
    try {
      const output = await this.client.send(
        new DeleteCommand({
          TableName: this.config.tableName,
          Key: {
            [DYNAMO_PK]: this.streamKey(
              reference.recordType,
              utcDayOf(reference.occurredAt),
            ),
            [DYNAMO_SK]: this.sortKey(reference.occurredAt, reference.eventId),
          },
          ReturnValues: 'ALL_OLD',
        }),
      );
      return output.Attributes !== undefined;
    } catch (error: unknown) {
      throw this.classify(error);
    }
  }

  /**
   * Apaga um intervalo: lista só as chaves de cada partição do fluxo (e das
   * repetições, no caso da auditoria) e remove em lotes de 25.
   */
  async deleteRange(range: LogRecordRange): Promise<number> {
    const fromIso = range.from.toISOString();
    const toIso = range.to.toISOString();
    let removed = 0;
    for (const recordType of physicalRecordTypes(range.recordType)) {
      for (const day of utcDaysBetweenDescending(range.from, range.to)) {
        const keys = await this.collectKeys({
          TableName: this.config.tableName,
          KeyConditionExpression: '#pk = :pk AND #sk BETWEEN :from AND :to',
          ExpressionAttributeNames: { '#pk': DYNAMO_PK, '#sk': DYNAMO_SK },
          ExpressionAttributeValues: {
            ':pk': this.streamKey(recordType, day),
            ':from': `${fromIso}#`,
            ':to': `${toIso}#￿`,
          },
          ProjectionExpression: '#pk, #sk',
        });
        removed += await this.batchDelete(keys);
      }
    }
    return removed;
  }

  close(): Promise<void> {
    return Promise.resolve();
  }

  private async collectKeys(input: QueryCommandInput): Promise<DynamoKey[]> {
    const keys: DynamoKey[] = [];
    let exclusiveStartKey: DynamoKey | undefined;
    do {
      const output = await this.send(
        new QueryCommand({ ...input, ExclusiveStartKey: exclusiveStartKey }),
      );
      for (const item of output.Items ?? []) {
        keys.push({
          [DYNAMO_PK]: item[DYNAMO_PK] as string,
          [DYNAMO_SK]: item[DYNAMO_SK] as string,
        });
      }
      exclusiveStartKey = (output.LastEvaluatedKey as DynamoKey) ?? undefined;
    } while (exclusiveStartKey);
    return keys;
  }

  private async batchDelete(keys: DynamoKey[]): Promise<number> {
    let removed = 0;
    for (let start = 0; start < keys.length; start += DYNAMO_BATCH_SIZE) {
      let pending = keys.slice(start, start + DYNAMO_BATCH_SIZE);
      let attempts = 0;
      while (pending.length > 0) {
        try {
          const output = await this.client.send(
            new BatchWriteCommand({
              RequestItems: {
                [this.config.tableName]: pending.map((key) => ({
                  DeleteRequest: { Key: key },
                })),
              },
            }),
          );
          const unprocessed = (
            output.UnprocessedItems?.[this.config.tableName] ?? []
          )
            .map(
              (request) => request.DeleteRequest?.Key as DynamoKey | undefined,
            )
            .filter((key): key is DynamoKey => key !== undefined);
          removed += pending.length - unprocessed.length;
          pending = unprocessed;
          attempts += 1;
          if (pending.length > 0 && attempts >= DYNAMO_BATCH_MAX_ATTEMPTS) {
            throw new LogWriteError(
              `DynamoDB (${this.stream}): ${pending.length} exclusões não processadas`,
              LogWriteFailureKind.Transient,
            );
          }
        } catch (error: unknown) {
          throw error instanceof LogWriteError ? error : this.classify(error);
        }
      }
    }
    return removed;
  }

  private componentName(): string {
    return `dynamodb-storage:${this.stream}`;
  }

  private streamKey(recordType: string, day: string): string {
    return `${DYNAMO_STREAM_PREFIX}#${recordType}#DAY#${day}`;
  }

  private sortKey(occurredAt: string, eventId: string): string {
    return `${occurredAt}#${eventId}`;
  }

  private dedupKey(fingerprint: string): DynamoKey {
    return {
      [DYNAMO_PK]: `${DYNAMO_DEDUP_PREFIX}#${fingerprint}`,
      [DYNAMO_SK]: DYNAMO_DEDUP_SK,
    };
  }

  private async putRecord(record: LogRecord): Promise<void> {
    if (
      Buffer.byteLength(JSON.stringify(record), 'utf8') > LOG_RECORD_MAX_BYTES
    ) {
      throw new LogWriteError(
        'registro excede o tamanho máximo',
        LogWriteFailureKind.Permanent,
      );
    }
    const item: Record<string, JsonValue | undefined> = {
      ...record,
      [DYNAMO_PK]: this.streamKey(
        record.recordType,
        utcDayOf(record.occurredAt),
      ),
      [DYNAMO_SK]: this.sortKey(record.occurredAt, record.eventId),
    };
    if (record.requestId) {
      item[DYNAMO_GSI1_PK] = `${DYNAMO_REQUEST_PREFIX}#${record.requestId}`;
      item[DYNAMO_GSI1_SK] =
        `${record.occurredAt}#${record.recordType}#${record.eventId}`;
    }
    try {
      await this.client.send(
        new PutCommand({
          TableName: this.config.tableName,
          Item: item,
          ConditionExpression: `attribute_not_exists(${DYNAMO_PK})`,
        }),
      );
    } catch (error: unknown) {
      // Um retry depois de timeout pode repetir uma escrita que já entrou.
      if (errorName(error) === CONDITIONAL_CHECK_FAILED) return;
      throw this.classify(error);
    }
  }

  /**
   * Uma repetição vira contador no primeiro evento da janela.
   *
   * Se o primeiro ainda não estiver lá (ou já tiver expirado), a repetição é
   * gravada como item próprio: contar errado é aceitável, perder não.
   */
  private async writeRepeat(record: LogRecord): Promise<void> {
    const reference = repeatReferenceOf(record);
    if (!reference) {
      await this.putRecord(record);
      return;
    }
    try {
      await this.client.send(
        new UpdateCommand({
          TableName: this.config.tableName,
          Key: {
            [DYNAMO_PK]: this.streamKey(
              LogRecordType.Audit,
              utcDayOf(reference.occurredAt),
            ),
            [DYNAMO_SK]: this.sortKey(reference.occurredAt, reference.eventId),
          },
          UpdateExpression:
            'ADD occurrenceCount :one SET lastOccurredAt = :occurredAt',
          ConditionExpression: `attribute_exists(${DYNAMO_PK})`,
          ExpressionAttributeValues: {
            ':one': 1,
            ':occurredAt': record.occurredAt,
          },
        }),
      );
    } catch (error: unknown) {
      if (errorName(error) === CONDITIONAL_CHECK_FAILED) {
        await this.putRecord(record);
        return;
      }
      throw this.classify(error);
    }
  }

  private async readDedup(key: DynamoKey): Promise<DedupReference | null> {
    try {
      const output = await this.client.send(
        new GetCommand({
          TableName: this.config.tableName,
          Key: key,
          ConsistentRead: true,
        }),
      );
      const item = (output.Item ?? null) as DedupItem | null;
      if (
        item &&
        typeof item.firstEventId === 'string' &&
        typeof item.firstOccurredAt === 'string'
      ) {
        return { eventId: item.firstEventId, occurredAt: item.firstOccurredAt };
      }
      return null;
    } catch (error: unknown) {
      this.emergency(this.componentName(), 'dedup não leu o marcador', {
        error: describeError(error),
      });
      return null;
    }
  }

  private filterInput(
    query: LogRecordQuery,
  ): Pick<
    QueryCommandInput,
    | 'FilterExpression'
    | 'ExpressionAttributeNames'
    | 'ExpressionAttributeValues'
  > {
    const names: Record<string, string> = { '#ttl': DYNAMO_TTL_ATTRIBUTE };
    const values: Record<string, JsonValue> = {
      ':now': Math.floor(this.clock().getTime() / 1000),
    };
    const clauses = ['#ttl > :now'];
    Object.entries(query.filters).forEach(([field, expected], index) => {
      names[`#f${index}`] = field;
      values[`:f${index}`] = expected;
      clauses.push(`#f${index} = :f${index}`);
    });
    Object.entries(query.contains ?? {}).forEach(([field, fragment], index) => {
      names[`#c${index}`] = field;
      values[`:c${index}`] = fragment;
      clauses.push(`contains(#c${index}, :c${index})`);
    });
    return {
      FilterExpression: clauses.join(' AND '),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    };
  }

  /** `Query` de um dia do fluxo, do mais recente ao mais antigo. */
  private dayPartitionInput(
    query: LogRecordQuery,
    day: string,
  ): QueryCommandInput {
    const base = this.filterInput(query);
    return {
      TableName: this.config.tableName,
      KeyConditionExpression: '#pk = :pk AND #sk BETWEEN :from AND :to',
      ExpressionAttributeNames: {
        ...base.ExpressionAttributeNames,
        '#pk': DYNAMO_PK,
        '#sk': DYNAMO_SK,
      },
      ExpressionAttributeValues: {
        ...base.ExpressionAttributeValues,
        ':pk': this.streamKey(query.recordType, day),
        ':from': `${query.from.toISOString()}#`,
        ':to': `${query.to.toISOString()}#￿`,
      },
      FilterExpression: base.FilterExpression,
      ScanIndexForward: false,
    };
  }

  /** `Query` no índice esparso por requisição, filtrando o tipo. */
  private requestPartitionInput(
    query: LogRecordQuery,
    requestId: string,
  ): QueryCommandInput {
    const base = this.filterInput(query);
    return {
      TableName: this.config.tableName,
      IndexName: DYNAMO_GSI1_NAME,
      KeyConditionExpression: '#gpk = :gpk AND #gsk BETWEEN :from AND :to',
      ExpressionAttributeNames: {
        ...base.ExpressionAttributeNames,
        '#gpk': DYNAMO_GSI1_PK,
        '#gsk': DYNAMO_GSI1_SK,
        '#rt': 'recordType',
      },
      ExpressionAttributeValues: {
        ...base.ExpressionAttributeValues,
        ':gpk': `${DYNAMO_REQUEST_PREFIX}#${requestId}`,
        ':from': `${query.from.toISOString()}#`,
        ':to': `${query.to.toISOString()}#￿`,
        ':rt': query.recordType,
      },
      FilterExpression: `${base.FilterExpression} AND #rt = :rt`,
      ScanIndexForward: false,
    };
  }

  /** Quantos itens a partição tem depois dos filtros. */
  private async countPartition(input: QueryCommandInput): Promise<number> {
    let total = 0;
    let exclusiveStartKey: DynamoKey | undefined;
    do {
      const output = await this.send(
        new QueryCommand({
          ...input,
          Select: 'COUNT',
          ExclusiveStartKey: exclusiveStartKey,
        }),
      );
      total += output.Count ?? 0;
      exclusiveStartKey = (output.LastEvaluatedKey as DynamoKey) ?? undefined;
    } while (exclusiveStartKey);
    return total;
  }

  /** Lê a partição pulando `skip` itens e devolvendo até `take`. */
  private async readPartition(
    input: QueryCommandInput,
    skip: number,
    take: number,
  ): Promise<LogRecord[]> {
    const items: LogRecord[] = [];
    let skipped = 0;
    let exclusiveStartKey: DynamoKey | undefined;
    do {
      const output = await this.send(
        new QueryCommand({ ...input, ExclusiveStartKey: exclusiveStartKey }),
      );
      for (const raw of stripKeys(output.Items ?? [])) {
        if (skipped < skip) {
          skipped += 1;
          continue;
        }
        items.push(raw);
        if (items.length >= take) return items;
      }
      exclusiveStartKey = (output.LastEvaluatedKey as DynamoKey) ?? undefined;
    } while (exclusiveStartKey);
    return items;
  }

  private async send(command: QueryCommand): Promise<QueryCommandOutput> {
    try {
      return await this.client.send(command);
    } catch (error: unknown) {
      throw this.classify(error);
    }
  }

  private classify(error: unknown): LogWriteError {
    const name = errorName(error);
    const status = (error as { $metadata?: { httpStatusCode?: number } })
      .$metadata?.httpStatusCode;
    const transient =
      TRANSIENT_ERROR_NAMES.has(name) ||
      (status !== undefined && status >= 500);
    return new LogWriteError(
      `DynamoDB (${this.stream}): ${name || 'erro desconhecido'}`,
      transient ? LogWriteFailureKind.Transient : LogWriteFailureKind.Permanent,
      error,
    );
  }
}

const errorName = (error: unknown): string =>
  typeof error === 'object' && error !== null && 'name' in error
    ? String((error as { name: unknown }).name)
    : '';

const stripKeys = (items: Record<string, unknown>[]): LogRecord[] =>
  items.map((item) => {
    const copy: Record<string, unknown> = { ...item };
    delete copy[DYNAMO_PK];
    delete copy[DYNAMO_SK];
    delete copy[DYNAMO_GSI1_PK];
    delete copy[DYNAMO_GSI1_SK];
    return copy as LogRecord;
  });

/** A referência ao primeiro evento, gravada no item de repetição. */
const repeatReferenceOf = (record: LogRecord): DedupReference | null => {
  const eventId = record.repeatsEventId;
  const occurredAt = record.repeatsOccurredAt;
  return typeof eventId === 'string' && typeof occurredAt === 'string'
    ? { eventId, occurredAt }
    : null;
};
