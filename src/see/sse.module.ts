import { Module } from '@nestjs/common';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';

@Module({
  controllers: [SseController],
  providers: [SseService],
  exports: [SseService], // Se quiser usar em outros módulos depois
})
export class SseModule {}
