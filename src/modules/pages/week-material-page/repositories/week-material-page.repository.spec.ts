import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { WeekMaterialsPageEntity } from '../entities/week-material-page.entity';
import { WeekMaterialsPageRepository } from './week-material-page.repository';

describe('WeekMaterialsPageRepository', () => {
  const defaultRepo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
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

    const moduleRef = await Test.createTestingModule({
      providers: [
        WeekMaterialsPageRepository,
        {
          provide: getRepositoryToken(WeekMaterialsPageEntity),
          useValue:
            defaultRepo as unknown as Repository<WeekMaterialsPageEntity>,
        },
      ],
    }).compile();

    repository = moduleRef.get(WeekMaterialsPageRepository);
  });

  it('lists pages with their route in a deterministic order', async () => {
    defaultRepo.find.mockResolvedValue([]);

    await repository.findAllPages();

    expect(defaultRepo.find).toHaveBeenCalledWith({
      relations: ['route'],
      order: { createdAt: 'DESC' },
    });
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
