import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { GetMeditationService } from 'src/modules/meditations/services/get-meditation.service';
import { RouteRepository } from './route-page.repository';
import { RouteEntity, RouteType } from './route-page.entity';
import { RouteService } from './route.service';

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

describe('RouteService', () => {
  const routeRepo = {
    findByPath: jest.fn(),
    upsertRoute: jest.fn(),
  };
  const getMeditationService = { getThisWeekMeditation: jest.fn() };

  let service: RouteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    routeRepo.upsertRoute.mockImplementation(
      (id: string, data: Partial<RouteEntity>) => ({ ...data, id }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        RouteService,
        { provide: RouteRepository, useValue: routeRepo },
        { provide: GetMeditationService, useValue: getMeditationService },
      ],
    }).compile();

    service = moduleRef.get(RouteService);
  });

  describe('generateAvailablePath', () => {
    it('usa o path base quando ele está livre', async () => {
      routeRepo.findByPath.mockResolvedValue(null);

      await expect(
        service.generateAvailablePath('Semana 12', 'materiais_semanal_'),
      ).resolves.toBe('materiais_semanal_semana_12');
    });

    it('adiciona sufixo quando o path já pertence a outra rota', async () => {
      routeRepo.findByPath
        .mockResolvedValueOnce(route('outra', 'materiais_semanal_semana_12'))
        .mockResolvedValueOnce(null);

      await expect(
        service.generateAvailablePath('Semana 12', 'materiais_semanal_'),
      ).resolves.toBe('materiais_semanal_semana_12_1');
    });

    it('mantém o path quando ele já pertence à própria rota', async () => {
      routeRepo.findByPath.mockResolvedValue(
        route('route-id', 'materiais_semanal_semana_12'),
      );

      await expect(
        service.generateAvailablePath(
          'Semana 12',
          'materiais_semanal_',
          'route-id',
        ),
      ).resolves.toBe('materiais_semanal_semana_12');
      expect(routeRepo.findByPath).toHaveBeenCalledTimes(1);
    });

    it('ignora a própria rota mas desvia de rotas de terceiros', async () => {
      routeRepo.findByPath
        .mockResolvedValueOnce(route('outra', 'materiais_semanal_pascoa'))
        .mockResolvedValueOnce(route('route-id', 'materiais_semanal_pascoa_1'));

      await expect(
        service.generateAvailablePath(
          'Páscoa',
          'materiais_semanal_',
          'route-id',
        ),
      ).resolves.toBe('materiais_semanal_pascoa_1');
    });
  });

  describe('upsertRouteWithAvailablePath', () => {
    it('grava o path resolvido, sem colidir com outra rota', async () => {
      routeRepo.findByPath
        .mockResolvedValueOnce(route('outra', 'materiais_semanal_pascoa'))
        .mockResolvedValueOnce(null);

      const saved = await service.upsertRouteWithAvailablePath(
        'route-id',
        { title: 'Páscoa', subtitle: 'Tema' },
        'materiais_semanal_',
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
      routeRepo.findByPath.mockResolvedValue(null);

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
});
