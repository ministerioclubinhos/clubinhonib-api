import { DataSource } from 'typeorm';

import { RouteRepository } from './route-page.repository';
import { RouteEntity, RouteType } from './route-page.entity';

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

describe('RouteRepository.findAvailablePath', () => {
  // O construtor só chama `createEntityManager`; nada aqui toca o banco.
  const dataSource = {
    createEntityManager: () => ({}),
  } as unknown as DataSource;

  let repo: RouteRepository;
  let findByPath: jest.SpyInstance;

  beforeEach(() => {
    repo = new RouteRepository(dataSource);
    findByPath = jest.spyOn(repo, 'findByPath');
  });

  it('usa o path base quando ele está livre', async () => {
    findByPath.mockResolvedValue(null);

    await expect(
      repo.findAvailablePath('Semana 12', 'materiais_semanal_'),
    ).resolves.toBe('materiais_semanal_semana_12');
  });

  it('adiciona sufixo quando o path já pertence a outra rota', async () => {
    findByPath
      .mockResolvedValueOnce(route('outra', 'materiais_semanal_semana_12'))
      .mockResolvedValueOnce(null);

    await expect(
      repo.findAvailablePath('Semana 12', 'materiais_semanal_'),
    ).resolves.toBe('materiais_semanal_semana_12_1');
  });

  it('numera as duplicatas em sequência: base, base_1, base_2', async () => {
    // Banco em memória: cada path devolvido é ocupado antes da próxima busca.
    const taken = new Set<string>();
    findByPath.mockImplementation((path: string) =>
      Promise.resolve(taken.has(path) ? route(`id-${path}`, path) : null),
    );
    const created: string[] = [];
    for (let index = 0; index < 4; index += 1) {
      const path = await repo.findAvailablePath(
        'Semana 27',
        'materiais_semanal_',
      );
      taken.add(path);
      created.push(path);
    }

    expect(created).toEqual([
      'materiais_semanal_semana_27',
      'materiais_semanal_semana_27_1',
      'materiais_semanal_semana_27_2',
      'materiais_semanal_semana_27_3',
    ]);
  });

  it('não confunde a semana 27 com a 2 nem com a 270', async () => {
    const taken = new Set([
      'materiais_semanal_semana_2',
      'materiais_semanal_semana_270',
    ]);
    findByPath.mockImplementation((path: string) =>
      Promise.resolve(taken.has(path) ? route(`id-${path}`, path) : null),
    );

    await expect(
      repo.findAvailablePath('Semana 27', 'materiais_semanal_'),
    ).resolves.toBe('materiais_semanal_semana_27');
  });

  it('mantém o path quando ele já pertence à própria rot', async () => {
    // Sem isso, editar uma página sem trocar o título ganharia um sufixo a
    // cada gravação: a rota colidiria consigo mesma.
    findByPath.mockResolvedValue(
      route('route-id', 'materiais_semanal_semana_12'),
    );

    await expect(
      repo.findAvailablePath('Semana 12', 'materiais_semanal_', 'route-id'),
    ).resolves.toBe('materiais_semanal_semana_12');
    expect(findByPath).toHaveBeenCalledTimes(1);
  });

  it('ignora a própria rota mas desvia de rotas de terceiros', async () => {
    findByPath
      .mockResolvedValueOnce(route('outra', 'materiais_semanal_pascoa'))
      .mockResolvedValueOnce(route('route-id', 'materiais_semanal_pascoa_1'));

    await expect(
      repo.findAvailablePath('Páscoa', 'materiais_semanal_', 'route-id'),
    ).resolves.toBe('materiais_semanal_pascoa_1');
  });
});
