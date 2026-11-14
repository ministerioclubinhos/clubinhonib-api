import { Test } from '@nestjs/testing';

import { AppConflictException } from 'src/shared/exceptions';

import { FeatureFlagsRepository } from '../feature-flags.repository';
import { FeatureFlagEntity } from '../entities/feature-flag.entity';
import { DEFAULT_FEATURE_FLAGS, RETIRED_FEATURE_FLAGS } from '../constants';
import { CreateFeatureFlagService } from './create-feature-flag.service';
import { GetFeatureFlagsService } from './get-feature-flags.service';

const buildFlag = (key: string) =>
  Object.assign(new FeatureFlagEntity(), {
    id: `id-${key}`,
    key,
    name: key,
    description: '',
    enabled: true,
    targetRoles: [],
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as FeatureFlagEntity;

describe('CreateFeatureFlagService', () => {
  const repository = {
    findByKey: jest.fn(),
    create: jest.fn((data: Partial<FeatureFlagEntity>) =>
      Object.assign(new FeatureFlagEntity(), {
        createdAt: new Date(),
        updatedAt: new Date(),
        ...data,
      }),
    ),
    save: jest.fn((flag: FeatureFlagEntity) => flag),
    remove: jest.fn(),
  };
  const getService = { invalidate: jest.fn(), invalidateAll: jest.fn() };

  let service: CreateFeatureFlagService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateFeatureFlagService,
        { provide: FeatureFlagsRepository, useValue: repository },
        { provide: GetFeatureFlagsService, useValue: getService },
      ],
    }).compile();

    service = moduleRef.get(CreateFeatureFlagService);
  });

  describe('catálogo de fábrica', () => {
    it('nenhuma chave de fábrica carrega o nome de um perfil', () => {
      // O perfil é uma dimensão da flag, não do nome dela.
      const perfis = ['admin', 'coordinator', 'teacher'];

      for (const { key } of DEFAULT_FEATURE_FLAGS) {
        expect(perfis.some((perfil) => key.includes(perfil))).toBe(false);
      }
    });

    it('todas as chaves usam apenas minúsculas, números e "_"', () => {
      for (const { key } of DEFAULT_FEATURE_FLAGS) {
        expect(key).toMatch(/^[a-z0-9][a-z0-9_]*$/);
      }
    });

    it('nenhuma chave de fábrica está na lista de aposentadas', () => {
      const aposentadas = new Set<string>(RETIRED_FEATURE_FLAGS);

      for (const { key } of DEFAULT_FEATURE_FLAGS) {
        expect(aposentadas.has(key)).toBe(false);
      }
    });
  });

  describe('seedDefaults', () => {
    it('cria só o que falta, sem sobrescrever o que a administração ajustou', async () => {
      repository.findByKey.mockImplementation((key: string) =>
        Promise.resolve(key === 'statistics' ? buildFlag(key) : null),
      );

      const created = await service.seedDefaults();

      expect(created.map((flag) => flag.key)).not.toContain('statistics');
      expect(created).toHaveLength(DEFAULT_FEATURE_FLAGS.length - 1);
    });
  });

  describe('retireLegacyFlags', () => {
    it('apaga as chaves aposentadas que ainda existem', async () => {
      repository.findByKey.mockImplementation((key: string) =>
        Promise.resolve(key === 'admin_pagelas' ? buildFlag(key) : null),
      );

      const retired = await service.retireLegacyFlags();

      expect(retired).toEqual(['admin_pagelas']);
      expect(repository.remove).toHaveBeenCalledTimes(1);
      expect(getService.invalidateAll).toHaveBeenCalled();
    });

    it('não toca em flag criada no painel', async () => {
      // Só as chaves listadas saem; o resto é da administração.
      repository.findByKey.mockResolvedValue(null);

      const retired = await service.retireLegacyFlags();

      expect(retired).toEqual([]);
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('recusa uma chave já existente', async () => {
      repository.findByKey.mockResolvedValue(buildFlag('statistics'));

      await expect(
        service.create({ key: 'statistics', name: 'Outra' }),
      ).rejects.toBeInstanceOf(AppConflictException);
    });

    it('grava os perfis normalizados', async () => {
      repository.findByKey.mockResolvedValue(null);

      const created = await service.create({
        key: 'nova_flag',
        name: 'Nova',
        targetRoles: [' TEACHER ', 'admin'] as never,
      });

      expect(created.targetRoles).toEqual(['admin', 'teacher']);
      expect(created.audience).toBe('ADMIN_TEACHER');
    });
  });
});
