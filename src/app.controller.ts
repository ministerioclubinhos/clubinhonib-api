import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { HealthResponseDto } from './dto/health-response.dto';
import { resolveAiProviderMode } from './shared/providers/ai-queue/fake-ai-response.utils';
import { AI_PROVIDER_MODE_ENV } from './shared/providers/ai-queue/constants';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  getHealth(): HealthResponseDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.ENVIRONMENT || 'unknown',
      // Os E2E recusam rodar contra uma API que chama o provedor de verdade.
      aiProviderMode: resolveAiProviderMode(
        process.env[AI_PROVIDER_MODE_ENV],
        process.env.NODE_ENV,
      ),
    };
  }
}
