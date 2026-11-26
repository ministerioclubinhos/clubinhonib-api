import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { DATABASE_ENTITIES } from './entities';

/**
 * `DataSource` usado pelo CLI do TypeORM para gerar e aplicar migrations.
 *
 * Usa as mesmas entidades da aplicação — gerar a partir de um conjunto
 * diferente produziria um diff inventado — e o mesmo mapeamento de nomes, que é
 * o padrão do TypeORM em ambos os lados.
 *
 * Nunca aponte isto para um banco compartilhado: a geração compara o schema
 * real com as entidades, e o `migration:run` escreve. Por isso o arquivo de
 * ambiente padrão é o local, e um host remoto só passa com autorização
 * explícita.
 */
loadEnv({ path: process.env.ENV_FILE ?? 'env/local.env' });

/** Hosts considerados descartáveis para geração e aplicação de migration. */
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal'];

/**
 * Autoriza explicitamente um host remoto.
 *
 * Existe para o caso raro de um ambiente controlado precisar rodar a migration
 * pelo CLI; sem a variável, o CLI se recusa a tocar em qualquer banco que não
 * seja local.
 */
const ALLOW_REMOTE = process.env.DB_MIGRATION_ALLOW_REMOTE === 'true';

const host = process.env.DB_HOST ?? 'localhost';

if (!LOCAL_HOSTS.includes(host) && !ALLOW_REMOTE) {
  throw new Error(
    `Migration bloqueada: DB_HOST="${host}" não é um banco local. ` +
      'Aponte ENV_FILE para um ambiente descartável ou, em um ambiente ' +
      'controlado e autorizado, defina DB_MIGRATION_ALLOW_REMOTE=true.',
  );
}

// Uma única exportação de `DataSource`: o CLI recusa o arquivo que exporta
// mais de uma, e a exportação nomeada mais a padrão contavam como duas.
export default new DataSource({
  type: 'mysql',
  host,
  port: Number(process.env.DB_PORT ?? 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'test',
  entities: DATABASE_ENTITIES,
  migrations: ['src/database/migrations/*.ts'],
  // O CLI nunca sincroniza: quem altera o schema é a migration gerada.
  synchronize: false,
  migrationsTableName: 'migrations',
});
