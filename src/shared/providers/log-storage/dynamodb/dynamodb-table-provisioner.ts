import {
  CreateTableCommand,
  DescribeTableCommand,
  ResourceNotFoundException,
  UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { OnApplicationBootstrap } from '@nestjs/common';

import {
  DYNAMO_GSI1_NAME,
  DYNAMO_GSI1_PK,
  DYNAMO_GSI1_SK,
  DYNAMO_PK,
  DYNAMO_SK,
  DYNAMO_TABLE_READY_ATTEMPTS,
  DYNAMO_TABLE_READY_DELAY_MS,
  DYNAMO_TTL_ATTRIBUTE,
} from '../constants';
import { DynamoDbStorageConfig, EmergencySink } from '../types';
import { describeError } from '../utils';

/**
 * Cria a tabela no DynamoDB Local quando ela não existe.
 *
 * Só age quando há `endpoint` configurado — o sinal de que é o container de
 * desenvolvimento. Em staging/produção a tabela vem da infraestrutura, e a
 * aplicação não tem (nem deve ter) permissão de `CreateTable`.
 */
export class DynamoDbLocalTableProvisioner implements OnApplicationBootstrap {
  constructor(
    private readonly client: DynamoDBDocumentClient | null,
    private readonly config: DynamoDbStorageConfig | null,
    private readonly emergency: EmergencySink,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((done) => setTimeout(done, ms)),
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.provision();
  }

  /** `true` quando a tabela existe (ou passou a existir) ao final. */
  async provision(): Promise<boolean> {
    if (!this.client || !this.config?.endpoint) return false;
    const tableName = this.config.tableName;
    try {
      if (await this.exists(tableName)) return true;
      await this.client.send(
        new CreateTableCommand({
          TableName: tableName,
          BillingMode: 'PAY_PER_REQUEST',
          AttributeDefinitions: [
            { AttributeName: DYNAMO_PK, AttributeType: 'S' },
            { AttributeName: DYNAMO_SK, AttributeType: 'S' },
            { AttributeName: DYNAMO_GSI1_PK, AttributeType: 'S' },
            { AttributeName: DYNAMO_GSI1_SK, AttributeType: 'S' },
          ],
          KeySchema: [
            { AttributeName: DYNAMO_PK, KeyType: 'HASH' },
            { AttributeName: DYNAMO_SK, KeyType: 'RANGE' },
          ],
          GlobalSecondaryIndexes: [
            {
              IndexName: DYNAMO_GSI1_NAME,
              KeySchema: [
                { AttributeName: DYNAMO_GSI1_PK, KeyType: 'HASH' },
                { AttributeName: DYNAMO_GSI1_SK, KeyType: 'RANGE' },
              ],
              Projection: { ProjectionType: 'ALL' },
            },
          ],
        }),
      );
      await this.waitUntilActive(tableName);
      await this.client.send(
        new UpdateTimeToLiveCommand({
          TableName: tableName,
          TimeToLiveSpecification: {
            AttributeName: DYNAMO_TTL_ATTRIBUTE,
            Enabled: true,
          },
        }),
      );
      return true;
    } catch (error: unknown) {
      this.emergency('dynamodb-local', 'não foi possível preparar a tabela', {
        table: tableName,
        endpoint: this.config.endpoint,
        error: describeError(error),
      });
      return false;
    }
  }

  private async exists(tableName: string): Promise<boolean> {
    try {
      const output = await this.client!.send(
        new DescribeTableCommand({ TableName: tableName }),
      );
      return output.Table?.TableStatus === 'ACTIVE';
    } catch (error: unknown) {
      if (error instanceof ResourceNotFoundException) return false;
      if ((error as { name?: string }).name === 'ResourceNotFoundException') {
        return false;
      }
      throw error;
    }
  }

  private async waitUntilActive(tableName: string): Promise<void> {
    for (let attempt = 0; attempt < DYNAMO_TABLE_READY_ATTEMPTS; attempt += 1) {
      if (await this.exists(tableName)) return;
      await this.sleep(DYNAMO_TABLE_READY_DELAY_MS);
    }
    throw new Error(`tabela ${tableName} não ficou ativa a tempo`);
  }
}
