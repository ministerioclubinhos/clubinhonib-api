import { Test } from '@nestjs/testing';
import { EntityManager } from 'typeorm';

import { RouteRepository } from '../route-page.repository';
import { RouteEntity, RouteType } from '../route-page.entity';
import { CreateRouteService } from './create-route.service';

const dados = {
  title: 'Semana 12',
  subtitle: 'Materiais',
  description: '',
  idToFetch: 'page-id',
  entityId: 'page-id',
  entityType: 'WeekMaterialsPage',
  type: RouteType.PAGE,
};

describe('CreateRouteService', () => {
  const routeRepo = {
    findAvailablePath: jest.fn(),
    saveRoute: jest.fn(),
    createInTransaction: jest.fn(),
  };

  let service: CreateRouteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    routeRepo.saveRoute.mockImplementation((r: RouteEntity) =>
      Object.assign(r, { id: 'route-id' }),
    );
    routeRepo.createInTransaction.mockImplementation(
      (_m: EntityManager, data: Partial<RouteEntity>) => ({
        ...data,
        id: 'route-id',
      }),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateRouteService,
        { provide: RouteRepository, useValue: routeRepo },
      ],
    }).compile();

    service = moduleRef.get(CreateRouteService);
  });

  it('resolve o path pelo repositório quando não recebe um', async () => {
    routeRepo.findAvailablePath.mockResolvedValue('materiais_semana_12');

    const criada = await service.createRoute({
      ...dados,
      prefix: 'materiais_',
    });

    expect(routeRepo.findAvailablePath).toHaveBeenCalledWith(
      'Semana 12',
      'materiais_',
      undefined,
    );
    expect(criada.path).toBe('materiais_semana_12');
  });

  it('respeita o path informado, sem consultar o banco', async () => {
    const criada = await service.createRoute({ ...dados, path: 'escolhido' });

    expect(routeRepo.findAvailablePath).not.toHaveBeenCalled();
    expect(criada.path).toBe('escolhido');
  });

  it('a rota nasce pública por padrão e com imagem vazia', async () => {
    const criada = await service.createRoute({ ...dados, path: 'p' });

    expect(criada.public).toBe(true);
    expect(criada.image).toBe('');
  });

  it('grava dentro da transação de quem chamou', async () => {
    // A rota e a página precisam nascer juntas, ou nenhuma das duas.
    const manager = {} as EntityManager;

    await service.createRouteWithManager(manager, {
      ...dados,
      path: 'materiais_semana_12',
      public: false,
    });

    expect(routeRepo.createInTransaction).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ path: 'materiais_semana_12', public: false }),
    );
  });
});
