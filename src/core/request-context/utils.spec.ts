import { UserRole } from 'src/core/auth/auth.types';
import {
  LogActorType,
  LogSourceType,
} from 'src/shared/providers/log-storage/enums';

import {
  actorDisplayName,
  actorFromRequestUser,
  actorNameSearchKey,
  createExecutionContext,
  resourceTypeFromRoute,
  unmatchedRouteName,
} from './utils';

describe('createExecutionContext', () => {
  it('HTTP nasce anônimo; job nasce como sistema', () => {
    expect(createExecutionContext(LogSourceType.Http).actorType).toBe(
      LogActorType.Anonymous,
    );
    expect(createExecutionContext(LogSourceType.Job).actorType).toBe(
      LogActorType.System,
    );
  });
});

describe('actorFromRequestUser', () => {
  it('só aceita identidade validada com userId', () => {
    expect(actorFromRequestUser(undefined)).toBeNull();
    expect(actorFromRequestUser({ role: 'admin' })).toBeNull();
    expect(actorFromRequestUser({ userId: 'u1', role: 'ADMIN' })).toEqual({
      actorId: 'u1',
      actorRole: UserRole.ADMIN,
      actorName: null,
    });
    expect(actorFromRequestUser({ userId: 'u1', role: 'chefe' })).toEqual({
      actorId: 'u1',
      actorRole: null,
      actorName: null,
    });
  });
});

describe('unmatchedRouteName', () => {
  it('remove query string e pseudonimiza identificadores', () => {
    expect(
      unmatchedRouteName(
        'get',
        '/users/8f1c9b44-1111-4222-8333-944455556666/x?token=abc',
      ),
    ).toBe('http.unmatched.GET /users/:id/x');
    expect(unmatchedRouteName('POST', '/clubs/42')).toBe(
      'http.unmatched.POST /clubs/:id',
    );
  });
});

describe('resourceTypeFromRoute', () => {
  it('usa o primeiro segmento', () => {
    expect(resourceTypeFromRoute('/clubs/:id/toggle-active')).toBe('clubs');
    expect(resourceTypeFromRoute('/')).toBe('root');
  });
});

describe('nome do ator', () => {
  it('limpa, limita e gera a chave de busca sem acento', () => {
    expect(actorDisplayName('  Maria   Aparecida ')).toBe('Maria Aparecida');
    expect(actorDisplayName('')).toBeNull();
    expect(actorDisplayName(42)).toBeNull();
    expect(actorDisplayName('a'.repeat(300))).toHaveLength(120);
    expect(actorNameSearchKey(' João  ÁVILA ')).toBe('joao avila');
  });

  it('vem de request.user quando o token traz o nome; token antigo fica sem', () => {
    expect(
      actorFromRequestUser({ userId: 'u1', role: 'admin', name: ' Ana ' }),
    ).toMatchObject({ actorId: 'u1', actorName: 'Ana' });
    expect(actorFromRequestUser({ userId: 'u1', role: 'admin' })).toMatchObject(
      { actorName: null },
    );
  });
});
