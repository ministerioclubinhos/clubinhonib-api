import { Controller, ExecutionContext, Get } from '@nestjs/common';

import { ComponentsRegistry } from 'src/core/request-context/discovery/components.registry';
import { RequestContextService } from 'src/core/request-context/request-context.service';
import { createExecutionContext } from 'src/core/request-context/utils';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import { AutomaticActionContextGuard } from './automatic-action-context.guard';

@Controller('clubs')
class ClubsController {
  @Get(':id/toggle-active')
  toggleActive(): void {}
}

const executionContext = (request: object): ExecutionContext =>
  ({
    getType: () => 'http',
    getClass: () => ClubsController,
    // eslint-disable-next-line @typescript-eslint/unbound-method
    getHandler: () => ClubsController.prototype.toggleActive,
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('AutomaticActionContextGuard', () => {
  const requestContext = new RequestContextService();
  const registry = {
    moduleOf: jest.fn(() => 'ClubsModule'),
  } as unknown as ComponentsRegistry;
  const guard = new AutomaticActionContextGuard(requestContext, registry);

  it('nunca nega e preenche módulo, controller, handler, rota e recurso antes do handler', () => {
    requestContext.run(createExecutionContext(LogSourceType.Http), () => {
      const allowed = guard.canActivate(
        executionContext({
          method: 'PATCH',
          params: { id: 'club-1' },
          route: { path: '/clubs/:id/toggle-active' },
        }),
      );
      expect(allowed).toBe(true);
      expect(requestContext.get()).toMatchObject({
        moduleName: 'ClubsModule',
        controllerName: 'ClubsController',
        handlerName: 'toggleActive',
        routeTemplate: '/clubs/:id/toggle-active',
        httpMethod: 'PATCH',
        resourceType: 'clubs',
        resourceId: 'club-1',
      });
    });
  });

  it('sem `route` do express reconstrói a rota pelos metadados', () => {
    requestContext.run(createExecutionContext(LogSourceType.Http), () => {
      guard.canActivate(executionContext({ method: 'PATCH', params: {} }));
      expect(requestContext.get()?.routeTemplate).toBe(
        '/clubs/:id/toggle-active',
      );
    });
  });

  it('contexto não HTTP passa direto', () => {
    expect(
      guard.canActivate({
        getType: () => 'rpc',
      } as unknown as ExecutionContext),
    ).toBe(true);
  });
});
