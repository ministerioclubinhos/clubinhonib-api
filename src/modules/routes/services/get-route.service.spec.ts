import { Test } from '@nestjs/testing';

import { GetMeditationService } from 'src/modules/meditations/services/get-meditation.service';

import { RouteRepository } from '../route-page.repository';
import { RouteEntity, RouteType } from '../route-page.entity';
import { GetRouteService } from './get-route.service';

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

describe('GetRouteService', () => {
  const routeRepo = {
    findAllRoutes: jest.fn(),
    findById: jest.fn(),
    findByEntityId: jest.fn(),
  };
  const getMeditationService = { getThisWeekMeditation: jest.fn() };

  let service: GetRouteService;

  beforeEach(async () => {
    jest.clearAllMocks();
    routeRepo.findAllRoutes.mockResolvedValue([route]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        GetRouteService,
        { provide: RouteRepository, useValue: routeRepo },
        { provide: GetMeditationService, useValue: getMeditationService },
      ],
    }).compile();

    service = moduleRef.get(GetRouteService);
  });

  it('sem meditação da semana, devolve só as rotas gravadas', async () => {
    getMeditationService.getThisWeekMeditation.mockResolvedValue(null);

    await expect(service.findAllRoutes()).resolves.toEqual([route]);
  });

  it('acrescenta um item por dia da meditação da semana', async () => {
    // Os dias não têm linha na tabela: são derivados da meditação vigente e
    // entram na lista para o site montar a navegação numa chamada só.
    getMeditationService.getThisWeekMeditation.mockResolvedValue({
      id: 'meditation-id',
      media: { url: 'https://bucket/capa.jpg' },
      days: [
        { id: 'd1', topic: 'Segunda', verse: 'Sl 1', day: 'monday' },
        { id: 'd2', topic: 'Terça', verse: 'Sl 2', day: 'tuesday' },
      ],
    });

    const rotas = await service.findAllRoutes();

    expect(rotas).toHaveLength(3);
    expect(rotas[1]).toMatchObject({
      id: 'd1',
      title: 'Segunda',
      path: 'monday',
      entityType: 'MeditationDay',
      entityId: 'meditation-id',
      // Dia de meditação não é rota publicável por conta própria.
      public: false,
    });
  });

  it('devolve null quando a entidade não tem rota', async () => {
    routeRepo.findByEntityId.mockResolvedValue(null);

    await expect(service.findRouteByEntityId('sumida')).resolves.toBeNull();
  });
});
