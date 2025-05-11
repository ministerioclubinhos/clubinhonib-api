import { Controller, Sse, Query, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { SseService, MessageEvent } from './sse.service';

@Controller('sse')
export class SseController {
  private readonly logger = new Logger(SseController.name);

  constructor(private readonly sseService: SseService) {}

  @Sse('stream')
  stream(@Query('token') token: string): Observable<MessageEvent> {
    const isReconnecting = this.sseService.isConnected(token);

    this.logger.log(
      isReconnecting
        ? `🔄 Reconnecting SSE for token: ${token}`
        : `📡 New SSE connection: ${token}`,
    );

    return new Observable<MessageEvent>((subscriber) => {
      this.sseService.addClient(token, subscriber);

      if (!this.sseService.isTaskRunning(token)) {
        this.logger.log(`⏳ Starting long task for token: ${token}`);
        this.sseService.startTask(token);
        this.executeLongTask(token);
      } else {
        this.logger.log(`🕓 Task already running for token: ${token}`);
      }

      return () => {
        this.sseService.removeClient(token);
        this.logger.warn(`❌ SSE connection closed: ${token}`);
      };
    });
  }

  private async executeLongTask(token: string): Promise<void> {
    await this.delay(30000); // Simulate 30s task

    const payload = {
      message: `Task completed for ${token}`,
      time: new Date().toISOString(),
    };

    this.sseService.sendMessage(token, payload);
    this.sseService.endTask(token);

    this.logger.log(`✅ Task completed for token: ${token}`);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
