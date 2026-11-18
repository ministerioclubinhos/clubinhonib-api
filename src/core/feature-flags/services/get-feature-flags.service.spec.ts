import { Test } from '@nestjs/testing';

import { UserRole } from 'src/core/auth/auth.types';
import { AppNotFoundException } from 'src/shared/exceptions';

import { FeatureFlagsRepository } from '../feature-flags.repository';
import { FeatureFlagEntity } from '../entities/feature-flag.entity';
import { GetFeatureFlagsService } from './get-feature-flags.service';

const buildFlag = (key: string, targetRoles: string[], enabled = true) =>
  Object.assign(new FeatureFlagEntity(), {
    id: `id-${key}`,
    key,
    name: key,
    description: '',
    enabled,
    targetRoles,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as FeatureFlagEntity;

describe('GetFeatureFlagsService', () => {
  const repository = {
    findAll: jest.fn(),
    findAllPaginated: jest.fn(),
    findAllFiltered: jest.fn(),
    findByKey: jest.fn(),
  };

  let service: GetFeatureFlagsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetFeatureFlagsService,
        { provide: FeatureFlagsRepository, useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(GetFeatureFlagsService);
  });

  describe('findAllPaginated', () => {
    it('pagina no banco quando não há recorte por audiência', async () => {
      repository.findAllPaginated.mockResolvedValue({
        items: [buildFlag('a', [])],
        total: 30,
      });

      const result = await service.findAllPaginated({ page: 2, limit: 12 });

      expect(repository.findAllFiltered).not.toHaveBeenCalled();
      expect(result.total).toBe(30);
      expect(result.pageCount).toBe(3);
    });

    it('recorta por combinação de perfis sobre a lista normalizada', async () => {
      // O recorte não dá para fazer em SQL: a coluna é JSON e guarda listas
      // fora de ordem e com grafias antigas.
      repository.findAllFiltered.mockResolvedValue([
        buildFlag('a', ['teacher', 'coordinator']),
        buildFlag('b', ['coordinator', 'teacher']),
        buildFlag('c', ['admin']),
        buildFlag('d', []),
      ]);

      const result = await service.findAllPaginated({
        audience: 'COORDINATOR_TEACHER',
      });

      expect(result.data.map((flag) => flag.key)).toEqual(['a', 'b']);
      expect(result.total).toBe(2);
    });

    it('conta o total do recorte, e não o da consulta inteira', async () => {
      repository.findAllFiltered.mockResolvedValue([
        buildFlag('a', ['admin']),
        buildFlag('b', []),
        buildFlag('c', ['admin']),
      ]);

      const result = await service.findAllPaginated({
        audience: 'ADMIN',
        page: 1,
        limit: 1,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(2);
      expect(result.pageCount).toBe(2);
    });
  });

  describe('getFlagsMap', () => {
    it('responde por perfil, e não pela flag ligada', async () => {
      repository.findAll.mockResolvedValue([
        buildFlag('publica', []),
        buildFlag('so_admin', ['admin']),
        buildFlag('coord_prof', ['coordinator', 'teacher']),
        buildFlag('desligada', [], false),
      ]);

      const map = await service.getFlagsMap(UserRole.TEACHER);

      expect(map).toEqual({
        publica: true,
        so_admin: false,
        coord_prof: true,
        desligada: false,
      });
    });

    it('para o visitante só valem as flags sem perfil alvo', async () => {
      repository.findAll.mockResolvedValue([
        buildFlag('publica', []),
        buildFlag('todos_perfis', ['admin', 'coordinator', 'teacher']),
      ]);

      const map = await service.getFlagsMap(null);

      expect(map).toEqual({ publica: true, todos_perfis: false });
    });
  });

  describe('isEnabled', () => {
    it('guarda a resposta por chave e perfil', async () => {
      repository.findByKey.mockResolvedValue(buildFlag('x', ['admin']));

      await service.isEnabled('x', UserRole.ADMIN);
      await service.isEnabled('x', UserRole.ADMIN);

      expect(repository.findByKey).toHaveBeenCalledTimes(1);
    });

    it('não confunde o resultado de dois perfis diferentes', async () => {
      repository.findByKey.mockResolvedValue(buildFlag('x', ['admin']));

      await expect(service.isEnabled('x', UserRole.ADMIN)).resolves.toBe(true);
      await expect(service.isEnabled('x', UserRole.TEACHER)).resolves.toBe(
        false,
      );
    });

    it('esquece o que guardou quando a flag muda', async () => {
      repository.findByKey.mockResolvedValue(buildFlag('x', ['admin']));
      await service.isEnabled('x', UserRole.ADMIN);

      service.invalidate('x');
      repository.findByKey.mockResolvedValue(buildFlag('x', ['admin'], false));

      await expect(service.isEnabled('x', UserRole.ADMIN)).resolves.toBe(false);
    });

    it('chave inexistente não libera nada', async () => {
      repository.findByKey.mockResolvedValue(null);

      await expect(service.isEnabled('sumiu', UserRole.ADMIN)).resolves.toBe(
        false,
      );
    });
  });

  describe('findEntityOrFail', () => {
    it('falha com o erro documentado quando a flag não existe', async () => {
      repository.findByKey.mockResolvedValue(null);

      await expect(service.findEntityOrFail('sumiu')).rejects.toBeInstanceOf(
        AppNotFoundException,
      );
    });
  });
});
