import { join } from 'node:path';

import { LogStorageKind } from './enums';
import { LogRecord } from './types';
import {
  expiresAtEpochSeconds,
  isLogicallyExpired,
  matchesFilters,
  parseLogStorageConfig,
  resolveLocalDirectory,
  serializeRecord,
  sliceForPage,
  utcDayOf,
  utcDaysBetweenDescending,
} from './utils';

const root = '/srv/app';
const env = (values: Record<string, string | undefined>) => (key: string) =>
  values[key];

describe('parseLogStorageConfig', () => {
  it('aplica os valores fornecidos quando as variáveis estão ausentes', () => {
    const config = parseLogStorageConfig(env({}), root);

    expect(config.environment).toBe('unknown');
    expect(config.observability.storage).toEqual({
      kind: LogStorageKind.File,
      directory: join(root, 'logs'),
    });
    expect(config.observability.ttlDays).toBe(1);
    expect(config.audit.storage).toEqual({
      kind: LogStorageKind.File,
      directory: join(root, 'audit'),
    });
    expect(config.audit.ttlDays).toBe(1);
    expect(config.audit.dedupSeconds).toBe(60);
  });

  it('aceita file para um fluxo e dynamodb para o outro', () => {
    const config = parseLogStorageConfig(
      env({
        ENVIRONMENT: 'Staging',
        OBS_STORAGE: 'dynamodb',
        LOG_DYNAMODB_TABLE_NAME: 'clubinho-logs-staging',
        AWS_REGION: 'us-east-1',
        AUDIT_STORAGE: 'dynamodb',
        AUDIT_TTL_DAYS: '30',
        AUDIT_DEDUP_SECONDS: '0',
      }),
      root,
    );

    expect(config.environment).toBe('staging');
    expect(config.observability.storage).toEqual({
      kind: LogStorageKind.DynamoDb,
      tableName: 'clubinho-logs-staging',
      region: 'us-east-1',
      endpoint: null,
    });
    expect(config.audit.ttlDays).toBe(30);
    expect(config.audit.dedupSeconds).toBe(0);
  });

  it.each([
    [{ OBS_STORAGE: 's3' }, /OBS_STORAGE aceita apenas/],
    [{ OBS_TTL_DAYS: 'um' }, /OBS_TTL_DAYS precisa ser um inteiro/],
    [{ OBS_TTL_DAYS: '0' }, /OBS_TTL_DAYS precisa estar entre/],
    [{ AUDIT_DEDUP_SECONDS: '-1' }, /AUDIT_DEDUP_SECONDS precisa estar entre/],
    [{ AUDIT_STORAGE: 'dynamodb' }, /LOG_DYNAMODB_TABLE_NAME é obrigatória/],
    [
      { AUDIT_STORAGE: 'dynamodb', LOG_DYNAMODB_TABLE_NAME: 't' },
      /AWS_REGION é obrigatória/,
    ],
    [{ OBS_LOCAL_DIR: '../fora' }, /dentro de/],
    [{ OBS_LOCAL_DIR: 'logs', AUDIT_LOCAL_DIR: 'logs' }, /pastas diferentes/],
    [
      { ENVIRONMENT: 'prod', OBS_STORAGE: 'file' },
      /OBS_STORAGE=file não é aceito em ENVIRONMENT="prod"/,
    ],
  ])('recusa %j', (values, message) => {
    expect(() => parseLogStorageConfig(env(values), root)).toThrow(message);
  });

  it('em produção sem variáveis usa os padrões (file implícito), sem derrubar', () => {
    const config = parseLogStorageConfig(env({ ENVIRONMENT: 'prod' }), root);
    expect(config.observability.storage.kind).toBe(LogStorageKind.File);
  });
});

describe('resolveLocalDirectory', () => {
  it('resolve relativo à raiz', () => {
    expect(resolveLocalDirectory('logs/api', 'X', root)).toBe(
      join(root, 'logs/api'),
    );
  });

  it.each(['..', '../x', '/etc/logs', '', 'a/../../b'])(
    'recusa %s',
    (value) => {
      expect(() => resolveLocalDirectory(value, 'X', root)).toThrow();
    },
  );
});

describe('datas', () => {
  it('utcDayOf usa o dia UTC, não o local', () => {
    expect(utcDayOf('2026-09-05T23:30:00.000Z')).toBe('2026-09-05');
    expect(utcDayOf(new Date('2026-09-06T00:10:00.000Z'))).toBe('2026-09-06');
  });

  it('utcDaysBetweenDescending lista do mais novo ao mais antigo', () => {
    expect(
      utcDaysBetweenDescending(
        new Date('2026-09-03T10:00:00Z'),
        new Date('2026-09-05T01:00:00Z'),
      ),
    ).toEqual(['2026-09-05', '2026-09-04', '2026-09-03']);
  });

  it('expiresAtEpochSeconds soma o TTL em dias', () => {
    const now = new Date('2026-09-05T00:00:00Z');
    expect(expiresAtEpochSeconds(now, 2)).toBe(
      Math.floor(now.getTime() / 1000) + 2 * 86_400,
    );
  });
});

describe('sliceForPage', () => {
  it('recorta a página pedida e devolve vazio além do fim', () => {
    const items = [1, 2, 3, 4, 5];
    expect(sliceForPage(items, 1, 2)).toEqual([1, 2]);
    expect(sliceForPage(items, 3, 2)).toEqual([5]);
    expect(sliceForPage(items, 4, 2)).toEqual([]);
    expect(sliceForPage(items, 0, 2)).toEqual([1, 2]);
  });
});

describe('registros', () => {
  const record = {
    eventId: 'e',
    level: 'error',
    statusCode: 500,
    expiresAtEpochSeconds: 100,
  } as unknown as LogRecord;

  it('matchesFilters compara como texto', () => {
    expect(matchesFilters(record, { level: 'error', statusCode: '500' })).toBe(
      true,
    );
    expect(matchesFilters(record, { level: 'warn' })).toBe(false);
    expect(matchesFilters(record, { missing: 'x' })).toBe(false);
  });

  it('isLogicallyExpired respeita o TTL do item', () => {
    expect(isLogicallyExpired(record, new Date(99 * 1000))).toBe(false);
    expect(isLogicallyExpired(record, new Date(100 * 1000))).toBe(true);
  });

  it('serializeRecord recusa item acima do limite', () => {
    const big = { ...record, message: 'x'.repeat(70_000) } as LogRecord;
    expect(() => serializeRecord(big)).toThrow(RangeError);
  });
});
