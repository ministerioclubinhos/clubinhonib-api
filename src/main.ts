import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { StructuredLoggerService } from './core/observability/providers/structured-logger.service';
import { writeBootstrapFailure } from './core/observability/utils/bootstrap-failure.utils';

async function bootstrap() {
  // Os logs da subida ficam em buffer até o logger estruturado existir; assim
  // um erro de inicialização de módulo também é persistido.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(StructuredLoggerService));
  app.flushLogs();
  app.enableShutdownHooks();

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
