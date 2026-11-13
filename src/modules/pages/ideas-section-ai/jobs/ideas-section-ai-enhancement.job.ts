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
import { GetFeatureFlagsService } from 'src/core/feature-flags/services/get-feature-flags.service';
import { FeatureFlagKeys } from 'src/core/feature-flags/enums/feature-flag-keys.enum';
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
    private readonly flags: GetFeatureFlagsService,
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
      // Flag desligada: nada vai à IA. Tentativas na fila esperam a flag
      // voltar (ou o cancelamento pela coordenação).
      if (
        !(await this.flags.isSwitchedOn(
          FeatureFlagKeys.IDEA_AI_ENHANCEMENT,
          false,
        ))
      )
        return;
      const owner = randomUUID();
      const attempt = await this.repo.claim(owner);
      if (!attempt) return;
      heartbeat = setInterval(() => {
        void this.repo
          .renew(attempt.id, owner)
          .then((renewed) => {
            if (!renewed)
              this.logger.warn(
                `Lease da melhoria ${attempt.id} não renovado: cancelada, excluída ou assumida por outro worker.`,
              );
          })
          .catch((error: unknown) =>
            this.logger.warn(
              `Falha ao renovar lease ${attempt.id}: ${error instanceof Error ? error.message : 'erro desconhecido'}`,
            ),
          );
      }, IDEA_AI.heartbeatMs);
      heartbeat.unref();
      await this.processor.process(attempt, owner);
    } catch (error: unknown) {
      this.logger.error(
        `Falha no worker de melhoria de ideias: ${error instanceof Error ? error.message : 'erro desconhecido'}. A fila será consultada novamente.`,
      );
    } finally {
      if (heartbeat) clearInterval(heartbeat);
      this.running = false;
    }
  }
}
