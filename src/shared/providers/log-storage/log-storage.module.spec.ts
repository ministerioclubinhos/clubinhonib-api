import { LogStorageKind, LogStream } from './enums';
import { createLogStorage } from './log-storage.module';
import { DynamoDbLogStorage } from './dynamodb/dynamodb-log-storage.provider';
import { FileLogStorage } from './file/file-log-storage.provider';
import {
  createDynamoDbDocumentClient,
  dynamoDbConfigOf,
} from './dynamodb/dynamodb-client.provider';
import { parseLogStorageConfig } from './utils';

const clock = () => new Date();

describe('seleção de provider por fluxo', () => {
  const fileConfig = parseLogStorageConfig(() => undefined, '/srv/app');
  const dynamoConfig = parseLogStorageConfig(
    (key) =>
      ({
        OBS_STORAGE: 'dynamodb',
        AUDIT_STORAGE: 'file',
        LOG_DYNAMODB_TABLE_NAME: 'logs',
        AWS_REGION: 'us-east-1',
      })[key],
    '/srv/app',
  );

  it('file/file não cria cliente DynamoDB', () => {
    expect(dynamoDbConfigOf(fileConfig)).toBeNull();
    expect(createDynamoDbDocumentClient(fileConfig)).toBeNull();
    expect(
      createLogStorage(fileConfig.observability, null, clock),
    ).toBeInstanceOf(FileLogStorage);
    expect(createLogStorage(fileConfig.audit, null, clock)).toBeInstanceOf(
      FileLogStorage,
    );
  });

  it('dynamodb/file cria um cliente e escolhe o provider certo para cada fluxo', () => {
    const client = createDynamoDbDocumentClient(dynamoConfig);
    expect(client).not.toBeNull();
    expect(dynamoConfig.observability.storage.kind).toBe(
      LogStorageKind.DynamoDb,
    );
    expect(
      createLogStorage(dynamoConfig.observability, client, clock),
    ).toBeInstanceOf(DynamoDbLogStorage);
    expect(createLogStorage(dynamoConfig.audit, client, clock)).toBeInstanceOf(
      FileLogStorage,
    );
    client?.destroy();
  });

  it('fluxo em DynamoDB sem cliente é erro de montagem', () => {
    expect(() =>
      createLogStorage(dynamoConfig.observability, null, clock),
    ).toThrow(/sem cliente/);
    expect(dynamoConfig.audit.stream).toBe(LogStream.Audit);
  });
});
