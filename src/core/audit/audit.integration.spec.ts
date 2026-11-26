import {
  CanActivate,
  Controller,
  Delete,
  ExecutionContext,
  Get,
  Global,
  INestApplication,
  Injectable,
  Logger,
  MiddlewareConsumer,
  Module,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Request } from 'express';
import * as request from 'supertest';

import { ObservabilityModule } from 'src/core/observability/observability.module';
import { StructuredLoggerService } from 'src/core/observability/providers/structured-logger.service';
import { WriteTechnicalLogService } from 'src/core/observability/services/write-technical-log.service';
import { REQUEST_ID_HEADER } from 'src/core/request-context/constants';
import { RequestContextMiddleware } from 'src/core/request-context/request-context.middleware';
import { RequestContextModule } from 'src/core/request-context/request-context.module';
import { RequestContextService } from 'src/core/request-context/request-context.service';
import {
  AppForbiddenException,
  AppInternalException,
  AppUnauthorizedException,
  ErrorCode,
} from 'src/shared/exceptions';
import {
  LOG_STORAGE_CLOCK,
  LOG_STORAGE_CONFIG,
} from 'src/shared/providers/log-storage/constants';
import {
  LogActorType,
  LogRecordType,
} from 'src/shared/providers/log-storage/enums';
import {
  AuditStoragePort,
  ObservabilityStoragePort,
} from 'src/shared/providers/log-storage/ports/log-storage.port';
import {
  DedupClaimInput,
  LogRecord,
} from 'src/shared/providers/log-storage/types';
import { parseLogStorageConfig } from 'src/shared/providers/log-storage/utils';

import { AuditModule } from './audit.module';
import { AuditOutcome } from './enums';
import { WriteAuditEventService } from './services/write-audit-event.service';

/** Storage em memória: nada toca disco ou AWS. */
class MemoryStorage {
  readonly queryable = true;
  readonly records: LogRecord[] = [];
  write(record: LogRecord): Promise<void> {
    this.records.push(record);
    return Promise.resolve();
  }
  claimDedup(input: DedupClaimInput) {
    return Promise.resolve({
      fingerprint: input.fingerprint,
      duplicateOf: null,
    });
  }
  query() {
    return Promise.resolve({ items: [], nextCursor: null });
  }
  close() {
    return Promise.resolve();
  }
}

/** Simula o `JwtAuthGuard`: cabeçalho `x-user` vira `request.user`. */
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: unknown }>();
    const header = req.header('x-user');
    if (!header)
      throw new AppUnauthorizedException(
        ErrorCode.TOKEN_MISSING,
        'Token não fornecido',
      );
    const [userId, role] = header.split(':');
    req.user = { userId, role, email: 'oculto@teste.com' };
    if (role !== 'admin')
      throw new AppForbiddenException(
        ErrorCode.ROLE_NOT_ALLOWED,
        'Acesso restrito',
      );
    return true;
  }
}

@Controller('widgets')
class WidgetsController {
  private readonly logger = new Logger(WidgetsController.name);

  @Get()
  list() {
    return [{ id: 'w1' }];
  }

  @UseGuards(FakeAuthGuard)
  @Post()
  create() {
    return { id: 'w-new', secretToken: 'nao-pode-vazar' };
  }

  @UseGuards(FakeAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return { message: `removido ${id}` };
  }

  @Post('boom')
  boom(): never {
    throw new AppInternalException(ErrorCode.DATABASE_ERROR, 'Falha no banco');
  }

  @Get('recovered')
  recovered() {
    try {
      throw new Error('erro engolido para joao@x.com');
    } catch (error: unknown) {
      this.logger.error(
        'Falha recuperada no provider',
        error instanceof Error ? error.stack : undefined,
      );
      return { ok: true };
    }
  }
}

const observability = new MemoryStorage();
const audit = new MemoryStorage();

/** Substitui o `LogStorageModule`: mesmas portas, memória em vez de disco. */
@Global()
@Module({
  providers: [
    {
      provide: LOG_STORAGE_CONFIG,
      useValue: parseLogStorageConfig(() => undefined, '/srv/app'),
    },
    { provide: LOG_STORAGE_CLOCK, useValue: () => new Date() },
    { provide: ObservabilityStoragePort, useValue: observability },
    { provide: AuditStoragePort, useValue: audit },
  ],
  exports: [
    LOG_STORAGE_CONFIG,
    LOG_STORAGE_CLOCK,
    ObservabilityStoragePort,
    AuditStoragePort,
  ],
})
class FakeStorageModule {}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
    RequestContextModule,
    FakeStorageModule,
    ObservabilityModule,
    AuditModule,
  ],
  controllers: [WidgetsController],
  providers: [FakeAuthGuard],
})
class TestAppModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}

describe('auditoria e observabilidade de ponta a ponta (sem serviços reais)', () => {
  let app: INestApplication;

  const flush = async () => {
    await app.get(WriteAuditEventService).settle();
    await app.get(WriteTechnicalLogService).settle();
  };
  const audits = () =>
    audit.records.filter((r) => r.recordType === LogRecordType.Audit);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleRef.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(StructuredLoggerService));
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
    await app.init();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  beforeEach(() => {
    observability.records.length = 0;
    audit.records.length = 0;
  });

  it('GET público: nada na auditoria (só mutações), mas o X-Request-Id vem na resposta', async () => {
    const res = await request(app.getHttpServer()).get('/widgets').expect(200);
    await flush();

    const requestId = res.header[REQUEST_ID_HEADER.toLowerCase()];
    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(audits()).toHaveLength(0);
    expect(observability.records).toHaveLength(0);
  });

  it('POST autenticado: ator com UUID e papel, resourceId do resultado, nada do corpo', async () => {
    await request(app.getHttpServer())
      .post('/widgets')
      .set('x-user', 'user-1:admin')
      .expect(201);
    await flush();

    const [event] = audits();
    expect(event).toMatchObject({
      actorType: LogActorType.User,
      actorId: 'user-1',
      actorRole: 'admin',
      resourceType: 'widgets',
      resourceId: 'w-new',
      statusCode: 201,
    });
    expect(JSON.stringify(audit.records)).not.toContain('nao-pode-vazar');
    expect(JSON.stringify(audit.records)).not.toContain('oculto@teste.com');
  });

  it('DELETE captura o id do param antes do handler', async () => {
    await request(app.getHttpServer())
      .delete('/widgets/w-9')
      .set('x-user', 'user-1:admin')
      .expect(200);
    await flush();
    expect(audits()[0]).toMatchObject({
      resourceId: 'w-9',
      handlerName: 'remove',
    });
  });

  it('401 e 403 são auditados como denied, com a ação conhecida e o ator quando validado', async () => {
    await request(app.getHttpServer()).post('/widgets').expect(401);
    await request(app.getHttpServer())
      .post('/widgets')
      .set('x-user', 'user-2:teacher')
      .expect(403);
    await flush();

    expect(audits()).toHaveLength(2);
    expect(audits()[0]).toMatchObject({
      outcome: AuditOutcome.Denied,
      statusCode: 401,
      errorCode: ErrorCode.TOKEN_MISSING,
      actionName: 'TestAppModule.WidgetsController.create',
      actorType: LogActorType.Anonymous,
    });
    expect(audits()[1]).toMatchObject({
      outcome: AuditOutcome.Denied,
      statusCode: 403,
      errorCode: ErrorCode.ROLE_NOT_ALLOWED,
      actorId: 'user-2',
      actorRole: 'teacher',
    });
  });

  it('404 sem handler vira boundary sanitizado', async () => {
    await request(app.getHttpServer())
      .post('/nao-existe/42?token=x')
      .expect(404);
    await flush();
    expect(audits()).toHaveLength(1);
    expect(audits()[0]).toMatchObject({
      outcome: AuditOutcome.NotFound,
      actionName: 'http.unmatched.POST /nao-existe/:id',
      handlerName: null,
    });
    expect(JSON.stringify(audit.records)).not.toContain('token=x');
  });

  it('erro 4xx útil vai à observabilidade como warn; 401 e rota inexistente são ruído', async () => {
    await request(app.getHttpServer()).post('/widgets').expect(401);
    await request(app.getHttpServer()).get('/nao-existe').expect(404);
    await flush();
    expect(observability.records).toHaveLength(0);

    // Rota diferente da do teste anterior: o mesmo 403 repetido em 60 s seria
    // contado na janela de repetição em vez de gravado de novo.
    const res = await request(app.getHttpServer())
      .delete('/widgets/w-1')
      .set('x-user', 'user-2:teacher')
      .expect(403);
    await flush();
    expect(observability.records).toHaveLength(1);
    expect(observability.records[0]).toMatchObject({
      level: 'warn',
      statusCode: 403,
      errorCode: ErrorCode.ROLE_NOT_ALLOWED,
      requestId: res.header[REQUEST_ID_HEADER.toLowerCase()],
      actorId: 'user-2',
      occurrenceCount: 1,
    });
    expect(JSON.stringify(observability.records)).not.toContain(
      'oculto@teste.com',
    );
  });

  it('500: envelope intacto, uma auditoria de falha e um registro técnico correlacionado', async () => {
    const res = await request(app.getHttpServer())
      .post('/widgets/boom')
      .expect(500);
    await flush();

    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: ErrorCode.DATABASE_ERROR,
        message: 'Falha no banco',
        path: '/widgets/boom',
      },
    });
    expect(audits()).toHaveLength(1);
    expect(audits()[0]).toMatchObject({
      outcome: AuditOutcome.Failed,
      statusCode: 500,
      errorCode: ErrorCode.DATABASE_ERROR,
    });
    expect(observability.records).toHaveLength(1);
    expect(observability.records[0]).toMatchObject({
      recordType: LogRecordType.Observability,
      level: 'error',
      context: 'GlobalExceptionFilter',
      errorCode: ErrorCode.DATABASE_ERROR,
      statusCode: 500,
      requestId: audits()[0].requestId,
      routeTemplate: '/widgets/boom',
    });
  });

  it('erro capturado e recuperado também é persistido, redigido e com o módulo de origem', async () => {
    const res = await request(app.getHttpServer())
      .get('/widgets/recovered')
      .expect(200);
    await flush();

    expect(observability.records).toHaveLength(1);
    expect(observability.records[0]).toMatchObject({
      context: 'WidgetsController',
      moduleName: 'TestAppModule',
      message: 'Falha recuperada no provider',
    });
    expect(observability.records[0].stack).not.toContain('joao@x.com');
    expect(observability.records[0].requestId).toBe(
      res.header[REQUEST_ID_HEADER.toLowerCase()],
    );
  });

  it('o contexto não vaza entre requests', () => {
    const service = app.get(RequestContextService);
    expect(service.get()).toBeNull();
  });
});
