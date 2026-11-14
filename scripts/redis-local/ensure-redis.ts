import { config } from 'dotenv';
import { AI_QUEUE } from 'src/shared/providers/ai-queue/constants';
import { ensureLocalRedis } from 'src/shared/providers/ai-queue/local-redis.provider';

async function main(): Promise<void> {
  if (process.env.ENV_FILE) {
    const loaded = config({ path: process.env.ENV_FILE });
    if (loaded.error)
      throw new Error('Não foi possível ler ENV_FILE para preparar o Redis.');
  }
  await ensureLocalRedis(process.env.REDIS_URL || AI_QUEUE.redisUrl);
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Falha ao preparar Redis.'}\n`,
  );
  process.exitCode = 1;
});
