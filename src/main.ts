import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { LESSON_CONTENT_LIMITS } from './modules/ai-lessons/constants/lesson-workflow.constants';
import { StructuredLoggerService } from './core/observability/providers/structured-logger.service';
import { writeBootstrapFailure } from './core/observability/utils/bootstrap-failure.utils';

async function bootstrap() {
  // Os logs da subida ficam em buffer até o logger estruturado existir; assim
  // um erro de inicialização de módulo também é persistido.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(StructuredLoggerService));
  app.flushLogs();
  app.enableShutdownHooks();
  // Explicit JSON limit: the Express default (100 kB) rejected studio saves
  // long before the documented document limits could be validated.
  app.useBodyParser('json', {
    limit: LESSON_CONTENT_LIMITS.JSON_BODY_LIMIT_BYTES,
  });

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // O filtro global é registrado por `APP_FILTER` no `AuditModule`, para
  // receber os serviços por injeção; instanciá-lo aqui o executaria duas vezes.

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap().catch((error: unknown) => {
  // O container pode nem existir: este writer não depende de injeção.
  writeBootstrapFailure(error);
  process.exit(1);
});
