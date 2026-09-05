import { Test } from '@nestjs/testing';

import { RouteRepository } from '../route-page.repository';
import { RouteEntity, RouteType } from '../route-page.entity';
import { DeleteRouteService } from './delete-route.service';

const route = Object.assign(new RouteEntity(), {
  id: 'route-id',
  path: 'pagina',
  title: 'Página',
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

describe('DeleteRouteService', () => {
  const routeRepo = {
    findById: jest.fn(),
    findByEntity: jest.fn(),
    removeRoute: jest.fn(),
  };

  let service: DeleteRouteService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        DeleteRouteService,
        { provide: RouteRepository, useValue: routeRepo },
      ],
    }).compile();

    service = moduleRef.get(DeleteRouteService);
  });

  it('remove a rota pelo id', async () => {
    routeRepo.findById.mockResolvedValue(route);

    await service.removeRoute('route-id');

    expect(routeRepo.removeRoute).toHaveBeenCalledWith(route);
  });

  it('rota inexistente não é erro', async () => {
    // Quem apaga uma página quer que a rota deixe de existir; se ela já não
    // existe, o objetivo está cumprido. Lançar aqui abortaria a remoção da
    // página por causa de algo que já estava certo.
    routeRepo.findById.mockResolvedValue(null);

    await expect(service.removeRoute('sumida')).resolves.toBeUndefined();
    expect(routeRepo.removeRoute).not.toHaveBeenCalled();
  });

  it('remove a rota de uma entidade', async () => {
    routeRepo.findByEntity.mockResolvedValue(route);

    await service.removeRouteByEntity('WeekMaterialsPage', 'page-id');

    expect(routeRepo.findByEntity).toHaveBeenCalledWith(
      'WeekMaterialsPage',
      'page-id',
    );
    expect(routeRepo.removeRoute).toHaveBeenCalledWith(route);
  });

  it('entidade sem rota também não é erro', async () => {
    routeRepo.findByEntity.mockResolvedValue(null);

    await expect(
      service.removeRouteByEntity('WeekMaterialsPage', 'sumida'),
    ).resolves.toBeUndefined();
    expect(routeRepo.removeRoute).not.toHaveBeenCalled();
  });
});
