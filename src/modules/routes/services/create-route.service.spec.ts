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
    createInSavepoint: jest.fn(),
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

  describe('createRouteWithAvailablePath', () => {
    const manager = {} as EntityManager;
    const duplicate = Object.assign(new Error('Duplicate entry'), {
      driverError: { code: 'ER_DUP_ENTRY' },
    });

    beforeEach(() => {
      routeRepo.createInSavepoint.mockImplementation(
        (_m: EntityManager, data: Partial<RouteEntity>) =>
          Promise.resolve({ ...data, id: 'route-id' }),
      );
    });

    it('grava com o path livre devolvido pelo repositório', async () => {
      routeRepo.findAvailablePath.mockResolvedValue('materiais_semana_12_1');

      const route = await service.createRouteWithAvailablePath(
        manager,
        dados,
        'materiais_',
      );

      // Dois materiais "Semana 12": o segundo recebe um caminho distinto.
      expect(route.path).toBe('materiais_semana_12_1');
      expect(routeRepo.createInSavepoint).toHaveBeenCalledWith(
        manager,
        expect.objectContaining({
          path: 'materiais_semana_12_1',
          public: true,
        }),
      );
    });

    it('escolhe outro path quando o banco recusa a gravação por unicidade', async () => {
      // Outra criação ocupou o caminho entre a consulta e a gravação.
      routeRepo.findAvailablePath
        .mockResolvedValueOnce('materiais_semana_12')
        .mockResolvedValueOnce('materiais_semana_12_1');
      routeRepo.createInSavepoint.mockRejectedValueOnce(duplicate);

      const route = await service.createRouteWithAvailablePath(
        manager,
        dados,
        'materiais_',
      );

      expect(route.path).toBe('materiais_semana_12_1');
      expect(routeRepo.createInSavepoint).toHaveBeenCalledTimes(2);
    });

    it('desempata sempre pelo próximo sufixo numérico, nunca por sufixo aleatório', async () => {
      // Três criações venceram a disputa antes desta: cada nova consulta já
      // enxerga a rota confirmada e devolve o sufixo seguinte.
      routeRepo.findAvailablePath
        .mockResolvedValueOnce('materiais_semana_12')
        .mockResolvedValueOnce('materiais_semana_12_1')
        .mockResolvedValueOnce('materiais_semana_12_2')
        .mockResolvedValueOnce('materiais_semana_12_3')
        .mockResolvedValueOnce('materiais_semana_12_4');
      routeRepo.createInSavepoint
        .mockRejectedValueOnce(duplicate)
        .mockRejectedValueOnce(duplicate)
        .mockRejectedValueOnce(duplicate)
        .mockRejectedValueOnce(duplicate);

      const route = await service.createRouteWithAvailablePath(
        manager,
        dados,
        'materiais_',
      );

      expect(route.path).toBe('materiais_semana_12_4');
      expect(routeRepo.createInSavepoint).toHaveBeenCalledTimes(5);
      expect(
        routeRepo.createInSavepoint.mock.calls.map(
          ([, data]: [EntityManager, Partial<RouteEntity>]) => data.path,
        ),
      ).toEqual([
        'materiais_semana_12',
        'materiais_semana_12_1',
        'materiais_semana_12_2',
        'materiais_semana_12_3',
        'materiais_semana_12_4',
      ]);
    });

    it('deriva o path do texto informado e mantém o título da rota', async () => {
      routeRepo.findAvailablePath.mockResolvedValue(
        'materiais_semanal_semana_27',
      );

      const route = await service.createRouteWithAvailablePath(
        manager,
        { ...dados, title: 'Semana 27 — O Bom Pastor' },
        'materiais_semanal_',
        'Semana 27',
      );

      expect(routeRepo.findAvailablePath).toHaveBeenCalledWith(
        'Semana 27',
        'materiais_semanal_',
        undefined,
      );
      expect(route.path).toBe('materiais_semanal_semana_27');
      expect(route.title).toBe('Semana 27 — O Bom Pastor');
    });

    it('sem texto próprio, deriva o path do título', async () => {
      routeRepo.findAvailablePath.mockResolvedValue('materiais_semana_12');

      await service.createRouteWithAvailablePath(
        manager,
        dados,
        'materiais_',
        '   ',
      );

      expect(routeRepo.findAvailablePath).toHaveBeenCalledWith(
        dados.title,
        'materiais_',
        undefined,
      );
    });

    it('desiste depois do limite de tentativas', async () => {
      routeRepo.findAvailablePath.mockResolvedValue('materiais_semana_12');
      routeRepo.createInSavepoint.mockRejectedValue(duplicate);

      await expect(
        service.createRouteWithAvailablePath(manager, dados, 'materiais_'),
      ).rejects.toBe(duplicate);
      expect(routeRepo.createInSavepoint).toHaveBeenCalledTimes(5);
    });

    it('propaga na hora um erro que não é colisão de path', async () => {
      const failure = new Error('db down');
      routeRepo.findAvailablePath.mockResolvedValue('materiais_semana_12');
      routeRepo.createInSavepoint.mockRejectedValue(failure);

      await expect(
        service.createRouteWithAvailablePath(manager, dados, 'materiais_'),
      ).rejects.toBe(failure);
      expect(routeRepo.createInSavepoint).toHaveBeenCalledTimes(1);
    });
  });
});
