import { UserRole } from 'src/core/auth/auth.types';

import { FeatureFlagEntity } from './entities/feature-flag.entity';
import {
  audienceOfRoles,
  isTargetedForRole,
  normalizeTargetRoles,
  rolesOfAudience,
  targetRolesOf,
} from './utils';

const buildFlag = (overrides: Partial<FeatureFlagEntity> = {}) =>
  Object.assign(new FeatureFlagEntity(), {
    id: 'flag-1',
    key: 'club_photo_upload',
    name: 'Envio de fotos',
    description: '',
    enabled: true,
    targetRoles: [],
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as FeatureFlagEntity;

describe('normalizeTargetRoles', () => {
  it('descarta espaços, caixa e repetições do que está gravado', () => {
    expect(normalizeTargetRoles([' Admin ', 'ADMIN', 'teacher'])).toEqual([
      UserRole.ADMIN,
      UserRole.TEACHER,
    ]);
  });

  it('ignora perfis desconhecidos', () => {
    expect(normalizeTargetRoles(['admin', 'diretor'])).toEqual([
      UserRole.ADMIN,
    ]);
  });

  it('devolve sempre a mesma ordem, seja qual for a de entrada', () => {
    // É a ordem estável que permite comparar duas combinações.
    expect(normalizeTargetRoles(['teacher', 'admin', 'coordinator'])).toEqual(
      normalizeTargetRoles(['coordinator', 'teacher', 'admin']),
    );
  });

  it('trata lista vazia e ausente como sem restrição', () => {
    expect(normalizeTargetRoles([])).toEqual([]);
    expect(normalizeTargetRoles(undefined)).toEqual([]);
    expect(normalizeTargetRoles(null)).toEqual([]);
  });
});

describe('audienceOfRoles', () => {
  it('nomeia cada uma das oito combinações', () => {
    expect(audienceOfRoles([])).toBe('EVERYONE');
    expect(audienceOfRoles([UserRole.ADMIN])).toBe('ADMIN');
    expect(audienceOfRoles([UserRole.COORDINATOR])).toBe('COORDINATOR');
    expect(audienceOfRoles([UserRole.TEACHER])).toBe('TEACHER');
    expect(audienceOfRoles([UserRole.ADMIN, UserRole.COORDINATOR])).toBe(
      'ADMIN_COORDINATOR',
    );
    expect(audienceOfRoles([UserRole.ADMIN, UserRole.TEACHER])).toBe(
      'ADMIN_TEACHER',
    );
    expect(audienceOfRoles([UserRole.COORDINATOR, UserRole.TEACHER])).toBe(
      'COORDINATOR_TEACHER',
    );
    expect(
      audienceOfRoles([UserRole.ADMIN, UserRole.COORDINATOR, UserRole.TEACHER]),
    ).toBe('ALL_ROLES');
  });

  it('não depende da ordem em que os perfis chegam', () => {
    expect(audienceOfRoles([UserRole.TEACHER, UserRole.ADMIN])).toBe(
      'ADMIN_TEACHER',
    );
  });

  it('vai e volta com rolesOfAudience', () => {
    expect(audienceOfRoles(rolesOfAudience('COORDINATOR_TEACHER'))).toBe(
      'COORDINATOR_TEACHER',
    );
  });
});

describe('targetRolesOf', () => {
  it('lê a coluna de perfis alvo', () => {
    const flag = buildFlag({ targetRoles: ['admin', 'teacher'] });

    expect(targetRolesOf(flag)).toEqual([UserRole.ADMIN, UserRole.TEACHER]);
  });

  it('cai para os perfis guardados em metadata, das flags antigas', () => {
    const flag = buildFlag({
      targetRoles: [],
      metadata: { targetRoles: ['coordinator'] },
    });

    expect(targetRolesOf(flag)).toEqual([UserRole.COORDINATOR]);
  });

  it('devolve vazio quando metadata traz outra coisa', () => {
    const flag = buildFlag({
      targetRoles: [],
      metadata: { targetRoles: 'admin' },
    });

    expect(targetRolesOf(flag)).toEqual([]);
  });
});

describe('isTargetedForRole', () => {
  it('desligada não vale para ninguém, nem para o perfil alvo', () => {
    const flag = buildFlag({ enabled: false, targetRoles: ['admin'] });

    expect(isTargetedForRole(flag, UserRole.ADMIN)).toBe(false);
  });

  it('sem perfil alvo vale até para quem não fez login', () => {
    const flag = buildFlag({ targetRoles: [] });

    expect(isTargetedForRole(flag, null)).toBe(true);
    expect(isTargetedForRole(flag, UserRole.TEACHER)).toBe(true);
  });

  it('com perfil alvo exige uma sessão', () => {
    // A diferença entre "para todos" e "os três perfis": esta segunda não
    // libera nada para o visitante.
    const flag = buildFlag({
      targetRoles: ['admin', 'coordinator', 'teacher'],
    });

    expect(isTargetedForRole(flag, null)).toBe(false);
    expect(isTargetedForRole(flag, UserRole.TEACHER)).toBe(true);
  });

  it('separa os perfis de uma combinação de dois', () => {
    const flag = buildFlag({ targetRoles: ['coordinator', 'teacher'] });

    expect(isTargetedForRole(flag, UserRole.COORDINATOR)).toBe(true);
    expect(isTargetedForRole(flag, UserRole.TEACHER)).toBe(true);
    expect(isTargetedForRole(flag, UserRole.ADMIN)).toBe(false);
  });

  it('aceita o perfil com espaços e caixa trocada', () => {
    const flag = buildFlag({ targetRoles: ['admin'] });

    expect(isTargetedForRole(flag, ' Admin ')).toBe(true);
  });
});
