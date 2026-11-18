import {
  CreateTableCommand,
  DescribeTableCommand,
  UpdateTimeToLiveCommand,
} from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { LogStorageKind } from '../enums';
import { DynamoDbLocalTableProvisioner } from './dynamodb-table-provisioner';

const notFound = () =>
  Object.assign(new Error('nf'), { name: 'ResourceNotFoundException' });

describe('DynamoDbLocalTableProvisioner', () => {
  const sent: string[] = [];
  const commands: { input: unknown }[] = [];
  let responses: unknown[];
  const client = {
    send: jest.fn(
      (command: { constructor: { name: string }; input: unknown }) => {
        sent.push(command.constructor.name);
        commands.push(command);
        const next = responses.shift();
        return next instanceof Error
          ? Promise.reject(next)
          : Promise.resolve(next ?? {});
      },
    ),
  } as unknown as DynamoDBDocumentClient;
  const emergency = jest.fn();
  const local = {
    kind: LogStorageKind.DynamoDb as const,
    tableName: 'logs',
    region: 'us-east-1',
    endpoint: 'http://localhost:8000',
  };

  beforeEach(() => {
    sent.length = 0;
    commands.length = 0;
    responses = [];
    emergency.mockClear();
  });

  it('sem endpoint (AWS de verdade) não toca na tabela', async () => {
    const provisioner = new DynamoDbLocalTableProvisioner(
      client,
      { ...local, endpoint: null },
      emergency,
    );
    expect(await provisioner.provision()).toBe(false);
    expect(sent).toEqual([]);
  });

  it('tabela já ativa: só descreve', async () => {
    responses = [{ Table: { TableStatus: 'ACTIVE' } }];
    expect(
      await new DynamoDbLocalTableProvisioner(
        client,
        local,
        emergency,
      ).provision(),
    ).toBe(true);
    expect(sent).toEqual([DescribeTableCommand.name]);
  });

  it('tabela ausente: cria com chaves, GSI e TTL, esperando ficar ativa', async () => {
    responses = [
      notFound(),
      {},
      { Table: { TableStatus: 'CREATING' } },
      { Table: { TableStatus: 'ACTIVE' } },
      {},
    ];
    const provisioner = new DynamoDbLocalTableProvisioner(
      client,
      local,
      emergency,
      () => Promise.resolve(),
    );
    expect(await provisioner.provision()).toBe(true);
    expect(sent).toEqual([
      DescribeTableCommand.name,
      CreateTableCommand.name,
      DescribeTableCommand.name,
      DescribeTableCommand.name,
      UpdateTimeToLiveCommand.name,
    ]);
    const create = commands[1] as CreateTableCommand;
    expect(create.input).toMatchObject({
      TableName: 'logs',
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
    });
    expect(create.input.GlobalSecondaryIndexes?.[0]).toMatchObject({
      IndexName: 'gsi1-request',
    });
  });

  it('falha ao criar não derruba o boot: sinaliza e devolve false', async () => {
    responses = [
      notFound(),
      Object.assign(new Error('x'), { name: 'AccessDeniedException' }),
    ];
    expect(
      await new DynamoDbLocalTableProvisioner(
        client,
        local,
        emergency,
      ).provision(),
    ).toBe(false);
    expect(emergency).toHaveBeenCalledWith(
      'dynamodb-local',
      'não foi possível preparar a tabela',
      expect.anything(),
    );
  });
});
