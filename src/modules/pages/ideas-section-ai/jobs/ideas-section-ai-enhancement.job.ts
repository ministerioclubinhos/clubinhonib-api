import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { IdeasSectionAiRepository } from '../repositories/ideas-section-ai.repository';
import { ProcessIdeaAiEnhancementService } from '../services/process-idea-ai-enhancement.service';
import { IDEA_AI } from '../constants';
@Injectable()
export class IdeasSectionAiEnhancementJob
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(IdeasSectionAiEnhancementJob.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private stopped = false;
  constructor(
    private readonly repo: IdeasSectionAiRepository,
    private readonly processor: ProcessIdeaAiEnhancementService,
  ) {}
  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), IDEA_AI.pollMs);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy(): void {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }
  async tick(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    let heartbeat: NodeJS.Timeout | undefined;
    try {
      const owner = randomUUID();
      const attempt = await this.repo.claim(owner);
      if (!attempt) return;
      heartbeat = setInterval(() => {
        void this.repo
          .renew(attempt.id, owner)
          .catch(() =>
            this.logger.warn(`Falha ao renovar lease ${attempt.id}`),
          );
      }, IDEA_AI.heartbeatMs);
      heartbeat.unref();
      await this.processor.process(attempt, owner);
    } catch {
      this.logger.error(
        'Falha no worker de melhoria de ideias. A fila será consultada novamente.',
      );
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      this.running = false;
    }
  }
}
