import {
  LogActorType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';
import { UserRole } from 'src/core/auth/auth.types';

import { RequestContextService } from './request-context.service';
import { createExecutionContext } from './utils';

describe('RequestContextService', () => {
  const service = new RequestContextService();

  it('fora de qualquer execução não há contexto e nada lança', () => {
    expect(service.get()).toBeNull();
    expect(service.requestId()).toBeNull();
    expect(() =>
      service.assignActor({ actorId: 'u', actorRole: null }),
    ).not.toThrow();
    expect(service.claimAuditWrite()).toBe(false);
  });

  it('isola execuções concorrentes', async () => {
    const seen: string[] = [];
    const run = (id: string, delay: number) =>
      service.run(
        createExecutionContext(LogSourceType.Http, 0, id),
        async () => {
          await new Promise((done) => setTimeout(done, delay));
          seen.push(service.requestId() as string);
        },
      );

    await Promise.all([run('a', 20), run('b', 5), run('c', 10)]);

    expect(seen.sort()).toEqual(['a', 'b', 'c']);
  });

  it('atribui ação, ator e recurso e grava a auditoria uma vez só', () => {
    service.run(createExecutionContext(LogSourceType.Http), () => {
      service.assignAction({
        moduleName: 'ClubsModule',
        controllerName: 'ClubsController',
        handlerName: 'create',
        routeTemplate: '/clubs',
        httpMethod: 'POST',
        resourceType: 'clubs',
        resourceId: null,
      });
      service.assignActor({ actorId: 'user-1', actorRole: UserRole.ADMIN });
      service.assignResourceId('club-1');
      service.assignResourceId('club-2');
      service.assignOutcome(201, null);

      const ctx = service.get();
      expect(ctx).toMatchObject({
        moduleName: 'ClubsModule',
        handlerName: 'create',
        actorType: LogActorType.User,
        actorId: 'user-1',
        actorRole: UserRole.ADMIN,
        resourceId: 'club-1',
        statusCode: 201,
      });
      expect(service.claimAuditWrite()).toBe(true);
      expect(service.claimAuditWrite()).toBe(false);
    });
  });

  it('ator nulo não sobrescreve o anônimo', () => {
    service.run(createExecutionContext(LogSourceType.Http), () => {
      service.assignActor(null);
      expect(service.get()?.actorType).toBe(LogActorType.Anonymous);
    });
  });
});
