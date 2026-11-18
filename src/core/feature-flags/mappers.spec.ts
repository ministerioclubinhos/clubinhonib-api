import { UserRole } from 'src/core/auth/auth.types';

import { FeatureFlagEntity } from './entities/feature-flag.entity';
import { toFeatureFlagResponse } from './mappers';

const buildFlag = (overrides: Partial<FeatureFlagEntity> = {}) =>
  Object.assign(new FeatureFlagEntity(), {
    id: 'flag-1',
    key: 'statistics',
    name: 'Estatísticas',
    description: 'Painel de métricas',
    enabled: true,
    targetRoles: ['admin', 'coordinator'],
    metadata: null,
    createdAt: new Date('2026-01-10T12:00:00.000Z'),
    updatedAt: new Date('2026-01-11T12:00:00.000Z'),
    ...overrides,
  }) as FeatureFlagEntity;

describe('feature flags mappers', () => {
  it('expõe exatamente o contrato de FeatureFlagResponseDto', () => {
    const response = toFeatureFlagResponse(buildFlag());

    expect(Object.keys(response).sort()).toEqual([
      'audience',
      'createdAt',
      'description',
      'enabled',
      'id',
      'key',
      'metadata',
      'name',
      'targetRoles',
      'updatedAt',
    ]);
  });

  it('acompanha os perfis com o nome da combinação', () => {
    const response = toFeatureFlagResponse(buildFlag());

    expect(response.targetRoles).toEqual([
      UserRole.ADMIN,
      UserRole.COORDINATOR,
    ]);
    expect(response.audience).toBe('ADMIN_COORDINATOR');
  });

  it('normaliza os perfis que vieram tortos do banco', () => {
    const response = toFeatureFlagResponse(
      buildFlag({ targetRoles: [' TEACHER ', 'teacher', 'inexistente'] }),
    );

    expect(response.targetRoles).toEqual([UserRole.TEACHER]);
    expect(response.audience).toBe('TEACHER');
  });

  it('chama de EVERYONE a flag sem perfis alvo', () => {
    const response = toFeatureFlagResponse(buildFlag({ targetRoles: [] }));

    expect(response.audience).toBe('EVERYONE');
  });

  it('devolve nulos e datas em ISO', () => {
    const response = toFeatureFlagResponse(
      buildFlag({ description: undefined }),
    );

    expect(response.description).toBeNull();
    expect(response.createdAt).toBe('2026-01-10T12:00:00.000Z');
  });
});
