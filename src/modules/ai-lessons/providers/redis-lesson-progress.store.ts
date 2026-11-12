import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { AI_QUEUE } from 'src/shared/providers/ai-queue/constants';
import { redisConnection } from 'src/shared/providers/ai-queue/utils';
import { LESSON_GENERATION_PROGRESS } from '../constants/lesson-generation-progress.constants';
import type { LessonProgressStore } from '../types/lesson-generation-progress.types';

/**
 * Generation progress in the Redis the AI queue already uses. Connects on the
 * first command and fails fast: callers treat every error as "no progress".
 */
@Injectable()
export class RedisLessonProgressStore
  implements LessonProgressStore, OnModuleDestroy
{
  private readonly logger = new Logger(RedisLessonProgressStore.name);
  private readonly url: string;
  private readonly root: string;
  private client?: Redis;
  private failing = false;

  constructor(config: ConfigService) {
    this.url = config.get<string>('REDIS_URL') || AI_QUEUE.redisUrl;
    const prefix = config.get<string>('AI_QUEUE_PREFIX') || AI_QUEUE.prefix;
    this.root = `${prefix}:${LESSON_GENERATION_PROGRESS.namespace}`;
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
    this.client = undefined;
  }

  async read(lessonId: string): Promise<string | null> {
    return this.redis().get(this.key(lessonId));
  }

  async write(
    lessonId: string,
    value: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis()
      .multi()
      .set(this.key(lessonId), value, 'EX', ttlSeconds)
      .zadd(this.index(), Date.now(), lessonId)
      .exec();
  }

  async touch(lessonId: string, ttlSeconds: number): Promise<void> {
    await this.redis().expire(this.key(lessonId), ttlSeconds);
  }

  async remove(lessonId: string): Promise<void> {
    await this.redis()
      .multi()
      .del(this.key(lessonId))
      .zrem(this.index(), lessonId)
      .exec();
  }

  async readAll(): Promise<string[]> {
    const redis = this.redis();
    const ids = await redis.zrange(this.index(), 0, -1);
    if (ids.length === 0) return [];
    const values = await redis.mget(ids.map((id) => this.key(id)));
    const expired = ids.filter((_, position) => values[position] === null);
    if (expired.length > 0) await redis.zrem(this.index(), ...expired);
    return values.filter((value): value is string => value !== null);
  }

  private key(lessonId: string): string {
    return `${this.root}:${lessonId}`;
  }

  private index(): string {
    return `${this.root}:${LESSON_GENERATION_PROGRESS.indexSuffix}`;
  }

  private redis(): Redis {
    if (this.client) return this.client;
    const client = new Redis({
      ...redisConnection(this.url),
      maxRetriesPerRequest: 1,
      connectTimeout: LESSON_GENERATION_PROGRESS.commandMs,
      commandTimeout: LESSON_GENERATION_PROGRESS.commandMs,
    });
    // One line per outage: the reconnection loop would repeat it forever.
    client.on('error', (error: unknown) => {
      if (this.failing) return;
      this.failing = true;
      this.logger.warn(
        `Redis do progresso de geração indisponível: ${error instanceof Error ? error.message : String(error)}`,
      );
    });
    client.on('ready', () => {
      this.failing = false;
    });
    this.client = client;
    return client;
  }
}
