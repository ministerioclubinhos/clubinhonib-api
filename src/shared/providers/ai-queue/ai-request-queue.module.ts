import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AiProviderSettingsModule } from 'src/modules/ai-lessons/ai-provider-settings.module';
import { AiProviderTransportProvider } from './ai-provider-transport.provider';
import { AiRequestProcessor } from './ai-request.processor';
import { AiRequestQueueService } from './ai-request-queue.service';

@Module({
  imports: [ConfigModule, AiProviderSettingsModule],
  providers: [
    AiProviderTransportProvider,
    AiRequestProcessor,
    AiRequestQueueService,
  ],
  exports: [AiRequestQueueService],
})
export class AiRequestQueueModule {}
