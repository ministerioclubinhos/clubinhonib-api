import { execFileSync } from 'node:child_process';
import Redis from 'ioredis';
import { LOCAL_REDIS } from './constants';
import { LocalRedisDependencies } from './types';
import { redisConnection } from './utils';

async function pingRedis(url: string): Promise<boolean> {
  const client = new Redis({
    ...redisConnection(url),
    lazyConnect: true,
    retryStrategy: () => null,
    maxRetriesPerRequest: 0,
    connectTimeout: LOCAL_REDIS.pingMs,
    commandTimeout: LOCAL_REDIS.pingMs,
  });
  client.on('error', () => undefined);
  try {
    await client.connect();
    return (await client.ping()) === 'PONG';
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

export async function ensureLocalRedis(
  url: string,
  deps: LocalRedisDependencies = {
    ping: pingRedis,
    docker: (args) =>
      execFileSync('docker', args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
    wait: () =>
      new Promise((resolve) => setTimeout(resolve, LOCAL_REDIS.retryMs)),
    log: (message) => process.stdout.write(`${message}\n`),
  },
): Promise<void> {
  const config = redisConnection(url);
  if (await deps.ping(url)) {
    deps.log('Redis já disponível; reutilizando a instância existente.');
    return;
  }
  if (!['localhost', '127.0.0.1', '::1'].includes(config.host ?? ''))
    throw new Error(
      'Redis remoto indisponível. Verifique REDIS_URL e a conectividade; nenhuma instância local foi criada.',
    );
  if (config.username || config.password || config.tls)
    throw new Error(
      'Redis local com autenticação/TLS indisponível. Inicie a instância configurada antes de continuar.',
    );
  try {
    deps.docker(['info', '--format', '{{.ServerVersion}}']);
  } catch {
    throw new Error(
      'Docker indisponível. Inicie o Docker ou disponibilize uma instância Redis em REDIS_URL.',
    );
  }
  let state = '';
  try {
    state = deps.docker([
      'inspect',
      '--format',
      '{{.State.Status}}',
      LOCAL_REDIS.container,
    ]);
  } catch {
    /* Container does not exist; docker info already validated the daemon. */
  }
  try {
    if (!state) {
      deps.log('Criando Redis local com persistência em volume Docker.');
      deps.docker([
        'run',
        '-d',
        '--name',
        LOCAL_REDIS.container,
        '--restart',
        'unless-stopped',
        '-p',
        `${config.host === '::1' ? '[::1]' : '127.0.0.1'}:${config.port}:6379`,
        '-v',
        `${LOCAL_REDIS.volume}:/data`,
        LOCAL_REDIS.image,
        'redis-server',
        '--appendonly',
        'yes',
        '--appendfsync',
        'everysec',
        '--maxmemory-policy',
        'noeviction',
      ]);
    } else if (state === 'paused') {
      deps.docker(['unpause', LOCAL_REDIS.container]);
    } else if (state === 'exited' || state === 'created') {
      deps.docker(['start', LOCAL_REDIS.container]);
    } else if (state !== 'running' && state !== 'restarting') {
      throw new Error();
    }
  } catch {
    throw new Error(
      'Não foi possível iniciar o Redis local. Confira o container clubinho-redis-local e a porta configurada.',
    );
  }
  for (let attempt = 0; attempt < LOCAL_REDIS.readyAttempts; attempt++) {
    if (await deps.ping(url)) {
      deps.log('Redis local pronto para a fila de IA.');
      return;
    }
    await deps.wait();
  }
  throw new Error(
    'Redis não respondeu ao PING. Confira a porta publicada pelo container e REDIS_URL.',
  );
}
