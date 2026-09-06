import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import {
  DYNAMODB_DOCUMENT_CLIENT,
  LOG_STORAGE_CLOCK,
  LOG_STORAGE_CONFIG,
} from './constants';
import {
  createDynamoDbDocumentClient,
  dynamoDbConfigOf,
} from './dynamodb/dynamodb-client.provider';
import { DynamoDbLocalTableProvisioner } from './dynamodb/dynamodb-table-provisioner';
import { DynamoDbLogStorage } from './dynamodb/dynamodb-log-storage.provider';
import { LogStorageKind } from './enums';
import { FileLogStorage } from './file/file-log-storage.provider';
import {
  AuditStoragePort,
  LogRecordStorage,
  ObservabilityStoragePort,
} from './ports/log-storage.port';
import { Clock, LogStorageConfig, StreamConfig } from './types';
import { emergencyWrite, parseLogStorageConfig } from './utils';

/** Escolhe o provider de um fluxo a partir da configuração validada. */
export function createLogStorage(
  stream: StreamConfig,
  client: DynamoDBDocumentClient | null,
  clock: Clock,
): LogRecordStorage {
  if (stream.storage.kind === LogStorageKind.File) {
    return new FileLogStorage(
      stream.storage,
      stream.stream,
      stream.ttlDays,
      clock,
      emergencyWrite,
    );
  }
  if (!client) {
    throw new Error(
      `Fluxo ${stream.stream} configurado para DynamoDB sem cliente disponível.`,
    );
  }
  return new DynamoDbLogStorage(
    client,
    stream.storage,
    stream.stream,
    clock,
    emergencyWrite,
  );
}

/**
 * Providers de persistência dos registros técnicos e de auditoria.
 *
 * Aqui mora todo o SDK e todo o file system; o resto da aplicação só conhece
 * as duas portas. A configuração é lida uma vez e falha no boot com mensagem
 * segura quando está inválida.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    { provide: LOG_STORAGE_CLOCK, useValue: (() => new Date()) as Clock },
    {
      provide: LOG_STORAGE_CONFIG,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): LogStorageConfig =>
        parseLogStorageConfig((key) => configService.get<string>(key)),
    },
    {
      provide: DYNAMODB_DOCUMENT_CLIENT,
      inject: [LOG_STORAGE_CONFIG],
      useFactory: createDynamoDbDocumentClient,
    },
    {
      // Só o DynamoDB Local (endpoint configurado) ganha tabela criada aqui.
      provide: DynamoDbLocalTableProvisioner,
      inject: [LOG_STORAGE_CONFIG, DYNAMODB_DOCUMENT_CLIENT],
      useFactory: (
        config: LogStorageConfig,
        client: DynamoDBDocumentClient | null,
      ) =>
        new DynamoDbLocalTableProvisioner(
          client,
          dynamoDbConfigOf(config),
          emergencyWrite,
        ),
    },
    {
      provide: ObservabilityStoragePort,
      inject: [LOG_STORAGE_CONFIG, DYNAMODB_DOCUMENT_CLIENT, LOG_STORAGE_CLOCK],
      useFactory: (
        config: LogStorageConfig,
        client: DynamoDBDocumentClient | null,
        clock: Clock,
      ) => createLogStorage(config.observability, client, clock),
    },
    {
      provide: AuditStoragePort,
      inject: [LOG_STORAGE_CONFIG, DYNAMODB_DOCUMENT_CLIENT, LOG_STORAGE_CLOCK],
      useFactory: (
        config: LogStorageConfig,
        client: DynamoDBDocumentClient | null,
        clock: Clock,
      ) => createLogStorage(config.audit, client, clock),
    },
  ],
  exports: [
    LOG_STORAGE_CONFIG,
    LOG_STORAGE_CLOCK,
    ObservabilityStoragePort,
    AuditStoragePort,
  ],
})
export class LogStorageModule {}
