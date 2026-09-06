import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import {
  AppConflictException,
  AppNotFoundException,
} from 'src/shared/exceptions';

import { RouteRepository } from '../route-page.repository';
import { RouteEntity, RouteType } from '../route-page.entity';
import { UpdateRouteService } from './update-route.service';

const route = (id: string, path: string): RouteEntity =>
  Object.assign(new RouteEntity(), {
    id,
    path,
    title: path,
    subtitle: '',
    description: '',
    public: true,
    current: false,
    image: '',
    idToFetch: 'page-id',
    entityType: 'WeekMaterialsPage',
    entityId: 'page-id',
    type: RouteType.PAGE,
  });

describe('UpdateRouteService', () => {
  const routeRepo = {
    findById: jest.fn(),
    findByPath: jest.fn(),
    findAvailablePath: jest.fn(),
    saveRoute: jest.fn(),
    upsertRoute: jest.fn(),
  };

  let service: UpdateRouteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    routeRepo.upsertRoute.mockImplementation(
      (id: string, data: Partial<RouteEntity>) => ({ ...data, id }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateRouteService,
        { provide: RouteRepository, useValue: routeRepo },
      ],
    }).compile();

    service = moduleRef.get(UpdateRouteService);
  });

  describe('upsertRouteWithAvailablePath', () => {
    it('grava o path resolvido pelo repositório', async () => {
      routeRepo.findAvailablePath.mockResolvedValue(
        'materiais_semanal_pascoa_1',
      );

      const saved = await service.upsertRouteWithAvailablePath(
        'route-id',
        { title: 'Páscoa', subtitle: 'Tema' },
        'materiais_semanal_',
      );

      // A própria rota entra como exceção: sem isso ela colidiria consigo
      // mesma e ganharia um sufixo a cada gravação.
      expect(routeRepo.findAvailablePath).toHaveBeenCalledWith(
        'Páscoa',
        'materiais_semanal_',
        'route-id',
      );
      expect(routeRepo.upsertRoute).toHaveBeenCalledWith(
        'route-id',
        expect.objectContaining({
          title: 'Páscoa',
          path: 'materiais_semanal_pascoa_1',
        }),
        undefined,
      );
      expect(saved.path).toBe('materiais_semanal_pascoa_1');
    });

    it('repassa o EntityManager da transação', async () => {
      const manager = {} as EntityManager;
      routeRepo.findAvailablePath.mockResolvedValue(
        'materiais_semanal_semana_1',
      );

      await service.upsertRouteWithAvailablePath(
        'route-id',
        { title: 'Semana 1' },
        'materiais_semanal_',
        manager,
      );

      expect(routeRepo.upsertRoute).toHaveBeenCalledWith(
        'route-id',
        expect.anything(),
        manager,
      );
    });
  });

  describe('updateRoute', () => {
    it('avisa quando a rota não existe', async () => {
      routeRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateRoute('sumida', { title: 'x' }),
      ).rejects.toBeInstanceOf(AppNotFoundException);
    });

    it('recusa um path que já é de outra rota', async () => {
      routeRepo.findById.mockResolvedValue(route('route-id', 'antigo'));
      routeRepo.findByPath.mockResolvedValue(route('outra', 'tomado'));

      await expect(
        service.updateRoute('route-id', { path: 'tomado' }),
      ).rejects.toBeInstanceOf(AppConflictException);

      expect(routeRepo.saveRoute).not.toHaveBeenCalled();
    });

    it('aceita o path quando ele já é da própria rota', async () => {
      const atual = route('route-id', 'meu_path');
      routeRepo.findById.mockResolvedValue(atual);
      routeRepo.findByPath.mockResolvedValue(atual);
      routeRepo.saveRoute.mockImplementation((r: RouteEntity) => r);

      await expect(
        service.updateRoute('route-id', { path: 'meu_path' }),
      ).resolves.toMatchObject({ id: 'route-id' });
    });
  });
});
