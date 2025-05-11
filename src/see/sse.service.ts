import { Injectable, Logger } from '@nestjs/common';
import { Subscriber } from 'rxjs';

export interface MessageEvent {
  data: any;
}

@Injectable()
export class SseService {
  private readonly logger = new Logger(SseService.name);

  private clients = new Map<string, Subscriber<MessageEvent>>();
  private activeTasks = new Set<string>();

  addClient(token: string, subscriber: Subscriber<MessageEvent>): void {
    this.logger.log(`✅ Connected: ${token}`);
    this.clients.set(token, subscriber);
  }

  removeClient(token: string): void {
    this.clients.delete(token);
    this.logger.warn(`❌ Disconnected: ${token}`);
  }

  sendMessage(token: string, data: any): void {
    const client = this.clients.get(token);

    if (client) {
      client.next({ data });
    } else {
      this.logger.warn(`⚠️ No active connection for token: ${token}`);
    }
  }

  isConnected(token: string): boolean {
    return this.clients.has(token);
  }

  isTaskRunning(token: string): boolean {
    return this.activeTasks.has(token);
  }

  startTask(token: string): void {
    this.activeTasks.add(token);
    this.logger.log(`🚀 Task started for token: ${token}`);
  }

  endTask(token: string): void {
    this.activeTasks.delete(token);
    this.logger.log(`🏁 Task ended for token: ${token}`);
  }
}
