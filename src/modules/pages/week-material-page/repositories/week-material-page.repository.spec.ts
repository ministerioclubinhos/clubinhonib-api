import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { WeekMaterialsPageRepository } from './week-material-page.repository';

describe('WeekMaterialsPageRepository', () => {
  /**
   * Só os métodos que o repositório encadeia. Cada um devolve o próprio mock,
   * que é o que o `QueryBuilder` real faz.
   */
  interface QueryBuilderMock {
    leftJoinAndSelect: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  }

  const queryBuilder: QueryBuilderMock = {
    leftJoinAndSelect: jest.fn(),
    andWhere: jest.fn(),
    orderBy: jest.fn(),
    skip: jest.fn(),
    take: jest.fn(),
    getManyAndCount: jest.fn(),
  };

  const resetQueryBuilder = (): void => {
    queryBuilder.leftJoinAndSelect.mockReturnValue(queryBuilder);
    queryBuilder.andWhere.mockReturnValue(queryBuilder);
    queryBuilder.orderBy.mockReturnValue(queryBuilder);
    queryBuilder.skip.mockReturnValue(queryBuilder);
    queryBuilder.take.mockReturnValue(queryBuilder);
    queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
  };

  const defaultRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const scopedRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const getRepositorySpy = jest.fn(() => scopedRepo);
  const manager = {
    getRepository: getRepositorySpy,
  } as unknown as EntityManager;

  let repository: WeekMaterialsPageRepository;

  beforeEach(async () => {
    jest.clearAllMocks();
    resetQueryBuilder();
    defaultRepo.createQueryBuilder.mockReturnValue(queryBuilder);

    const moduleRef = await Test.createTestingModule({
      providers: [
        WeekMaterialsPageRepository,
        // O repositório passou a abrir a transação, então recebe o `DataSource`.
        // Nenhum caso aqui transaciona: o duplo só satisfaz a injeção.
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: getRepositoryToken(WeekMaterialsPageEntity),
          useValue:
            defaultRepo as unknown as Repository<WeekMaterialsPageEntity>,
        },
      ],
    }).compile();

    repository = moduleRef.get(WeekMaterialsPageRepository);
  });

  it('pagina a listagem no banco, com a rota carregada', async () => {
    await repository.findAllPaginated({ page: 2, limit: 10 });

    expect(defaultRepo.createQueryBuilder).toHaveBeenCalledWith('page');
    expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
      'page.route',
      'route',
    );
    expect(queryBuilder.orderBy).toHaveBeenCalledWith('page.createdAt', 'DESC');
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
  });

  it('filtra busca e semana atual no banco, e não na tela', async () => {
    await repository.findAllPaginated({
      searchString: '  festa  ',
      currentWeek: true,
    });

    const clauses = (queryBuilder.andWhere.mock.calls as unknown[][]).map(
      (call) => String(call[0]),
    );
    expect(clauses.some((clause) => clause.includes('page.title'))).toBe(true);
    expect(queryBuilder.andWhere).toHaveBeenCalledWith(
      'page.currentWeek = :currentWeek',
      { currentWeek: true },
    );
    // O termo entra sem os espaços das pontas.
    const [, params] = (queryBuilder.andWhere.mock.calls as unknown[][])[0] as [
      string,
      { search: string },
    ];
    expect(params.search).toBe('%festa%');
  });

  it('loads one page with its route', async () => {
    defaultRepo.findOne.mockResolvedValue(null);

    await repository.findOnePageById('page-id');

    expect(defaultRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'page-id' },
      relations: ['route'],
    });
  });

  it('loads the page published for the current week', async () => {
    defaultRepo.findOne.mockResolvedValue(null);

    await repository.findCurrentWeek();

    expect(defaultRepo.findOne).toHaveBeenCalledWith({
      where: { currentWeek: true },
      relations: ['route'],
    });
  });

  it('creates and saves a page', async () => {
    const page = new WeekMaterialsPageEntity();
    defaultRepo.create.mockReturnValue(page);
    defaultRepo.save.mockResolvedValue(page);

    const content = {
      title: 'Semana 1',
      subtitle: 'Tema',
      description: 'Descrição',
      currentWeek: false,
    };

    await expect(repository.createPage(content)).resolves.toBe(page);
    expect(defaultRepo.create).toHaveBeenCalledWith(content);
    expect(defaultRepo.save).toHaveBeenCalledWith(page);
  });

  it('removes a page', async () => {
    const page = new WeekMaterialsPageEntity();

    await repository.removePage(page);

    expect(defaultRepo.remove).toHaveBeenCalledWith(page);
  });

  it('uses the transactional manager when one is supplied', async () => {
    const page = new WeekMaterialsPageEntity();
    scopedRepo.save.mockResolvedValue(page);
    scopedRepo.findOne.mockResolvedValue(page);

    await repository.savePage(page, manager);
    await repository.findOnePageById('page-id', manager);
    await repository.findCurrentWeek(manager);

    expect(getRepositorySpy).toHaveBeenCalledWith(WeekMaterialsPageEntity);
    expect(scopedRepo.save).toHaveBeenCalledWith(page);
    expect(scopedRepo.findOne).toHaveBeenCalledTimes(2);
    expect(defaultRepo.save).not.toHaveBeenCalled();
  });
});
