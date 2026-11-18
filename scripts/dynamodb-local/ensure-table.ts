/**
 * Garante a tabela de registros no DynamoDB Local.
 *
 * Chamado pelo `run.sh` depois de subir o container: lê o arquivo de ambiente
 * indicado em `ENV_FILE`, e, se algum fluxo usa `dynamodb` com endpoint local,
 * cria a tabela (chaves, GSI e TTL) quando ela não existe. Tabela existente
 * não é tocada. Sem endpoint local, não faz nada — em staging/produção a
 * tabela vem da infraestrutura.
 *
 *   ENV_FILE=env/local.env npm run dynamodb:local:ensure-table
 */
import { readFileSync } from 'node:fs';

const STARTUP_ATTEMPTS = 20;
const STARTUP_DELAY_MS = 1000;

import {
  createDynamoDbDocumentClient,
  dynamoDbConfigOf,
} from 'src/shared/providers/log-storage/dynamodb/dynamodb-client.provider';
import { DynamoDbLocalTableProvisioner } from 'src/shared/providers/log-storage/dynamodb/dynamodb-table-provisioner';
import {
  emergencyWrite,
  parseLogStorageConfig,
} from 'src/shared/providers/log-storage/utils';

/** `KEY=valor` por linha; comentários e vazios ignorados; aspas simples/duplas removidas. */
function readEnvFile(path: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of readFileSync(path, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function main(): Promise<number> {
  const envFile = process.env.ENV_FILE;
  if (!envFile) {
    process.stderr.write('ENV_FILE não informado.\n');
    return 1;
  }
  const env = readEnvFile(envFile);
  const config = parseLogStorageConfig((key) => env[key] ?? process.env[key]);
  const dynamo = dynamoDbConfigOf(config);

  if (!dynamo || !dynamo.endpoint) {
    process.stdout.write('Nenhum fluxo usa DynamoDB Local; nada a preparar.\n');
    return 0;
  }

  // O SDK exige credenciais mesmo no DynamoDB Local; qualquer par serve.
  process.env.AWS_ACCESS_KEY_ID ??= env.AWS_ACCESS_KEY_ID ?? 'local';
  process.env.AWS_SECRET_ACCESS_KEY ??= env.AWS_SECRET_ACCESS_KEY ?? 'local';

  const client = createDynamoDbDocumentClient(config);
  const provisioner = new DynamoDbLocalTableProvisioner(
    client,
    dynamo,
    emergencyWrite,
  );

  // O container acaba de subir e o Java ainda pode estar iniciando: a porta
  // abre antes de o serviço responder. Insiste por alguns segundos.
  let ready = false;
  for (let attempt = 1; attempt <= STARTUP_ATTEMPTS && !ready; attempt += 1) {
    ready = await provisioner.provision();
    if (!ready) await new Promise((done) => setTimeout(done, STARTUP_DELAY_MS));
  }
  client?.destroy();

  if (!ready) {
    process.stderr.write(
      `Tabela "${dynamo.tableName}" indisponível em ${dynamo.endpoint}.\n`,
    );
    return 1;
  }
  process.stdout.write(
    `Tabela "${dynamo.tableName}" pronta em ${dynamo.endpoint}.\n`,
  );
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exit(1);
  });
