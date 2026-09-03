import {
  AppForbiddenException,
  AppNotFoundException,
} from 'src/shared/exceptions';

import { PagelasRepository } from '../repositories/pagelas.repository';
import { PagelaEntity } from '../entities/pagela.entity';
import { CreatePagelasService } from './create-pagelas.service';
import { GetPagelasService } from './get-pagelas.service';
import { UpdatePagelasService } from './update-pagelas.service';
import { DeletePagelasService } from './delete-pagelas.service';
import { ResolvePagelaWeekService } from './resolve-pagela-week.service';

type RepoMock = jest.Mocked<
  Pick<
    PagelasRepository,
    | 'findAll'
    | 'findAllPaginated'
    | 'findOneInScope'
    | 'childIsWithinReach'
    | 'createOne'
    | 'updateOne'
    | 'deleteById'
  >
>;

type WeekMock = jest.Mocked<Pick<ResolvePagelaWeekService, 'resolve'>>;

const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const UPDATED_AT = new Date('2026-01-02T00:00:00Z');

const pagela = (overrides: Partial<PagelaEntity> = {}): PagelaEntity =>
  ({
    id: 'pagela-1',
    child: { id: 'child-1' },
    teacher: null,
    referenceDate: '2026-03-07',
    year: 2026,
    week: 5,
    present: true,
    didMeditation: true,
    recitedVerse: false,
    notes: null,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  }) as unknown as PagelaEntity;

describe('casos de uso de pagelas', () => {
  let repo: RepoMock;
  let weekService: WeekMock;
  let getService: GetPagelasService;
  let createService: CreatePagelasService;
  let updateService: UpdatePagelasService;
  let deleteService: DeletePagelasService;

  const admin = { role: 'admin', userId: 'admin-1' };
  const coordinator = { role: 'coordinator', userId: 'user-1' };
  const outsider = { role: 'user', userId: 'user-2' };

  const createDto = {
    childId: 'child-1',
    referenceDate: '2026-03-07',
    present: true,
    didMeditation: true,
    recitedVerse: false,
  };

  beforeEach(() => {
    repo = {
      findAll: jest.fn().mockResolvedValue([pagela()]),
      findAllPaginated: jest
        .fn()
        .mockResolvedValue({ items: [pagela()], total: 1 }),
      findOneInScope: jest.fn().mockResolvedValue(pagela()),
      childIsWithinReach: jest.fn().mockResolvedValue(true),
      createOne: jest.fn().mockResolvedValue(pagela()),
      updateOne: jest.fn().mockResolvedValue(pagela()),
      deleteById: jest.fn().mockResolvedValue(undefined),
    } as unknown as RepoMock;

    weekService = {
      resolve: jest.fn().mockResolvedValue({ year: 2026, week: 5 }),
    } as unknown as WeekMock;

    getService = new GetPagelasService(repo as unknown as PagelasRepository);
    createService = new CreatePagelasService(
      repo as unknown as PagelasRepository,
      weekService as unknown as ResolvePagelaWeekService,
    );
    updateService = new UpdatePagelasService(
      repo as unknown as PagelasRepository,
      getService,
      weekService as unknown as ResolvePagelaWeekService,
    );
    deleteService = new DeletePagelasService(
      repo as unknown as PagelasRepository,
      getService,
    );
  });

  describe('leitura', () => {
    it('entrega a página com o contexto de quem pede', async () => {
      const page = await getService.findAllPaginated(
        { page: 1, limit: 20 },
        coordinator,
      );

      expect(repo.findAllPaginated).toHaveBeenCalledWith(
        { page: 1, limit: 20 },
        coordinator,
        1,
        20,
      );
      expect(page.total).toBe(1);
      expect(page.data[0].childId).toBe('child-1');
    });

    it('recusa quem não trabalha com pagelas', async () => {
      await expect(
        getService.findAllPaginated({}, outsider),
      ).rejects.toBeInstanceOf(AppForbiddenException);
    });

    it('fora do alcance, a pagela não existe', async () => {
      repo.findOneInScope.mockResolvedValue(null);

      await expect(
        getService.findOne('pagela-1', coordinator),
      ).rejects.toBeInstanceOf(AppNotFoundException);
    });
  });

  describe('criação', () => {
    it('deriva semana e ano do período letivo quando não vierem', async () => {
      await createService.create(createDto, admin);

      expect(weekService.resolve).toHaveBeenCalledWith('2026-03-07', true);
      expect(repo.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2026, week: 5 }),
      );
    });

    it('respeita a semana e o ano informados, sem consultar o período', async () => {
      await createService.create({ ...createDto, week: 9, year: 2025 }, admin);

      expect(weekService.resolve).not.toHaveBeenCalled();
      expect(repo.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2025, week: 9 }),
      );
    });

    it('completa o que faltar quando só um dos dois vier', async () => {
      await createService.create({ ...createDto, week: 9 }, admin);

      expect(repo.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2026, week: 9 }),
      );
    });

    it('barra criança fora do alcance de quem pede', async () => {
      repo.childIsWithinReach.mockResolvedValue(false);

      await expect(
        createService.create(createDto, coordinator),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(repo.createOne).not.toHaveBeenCalled();
    });

    it('recusa quem não trabalha com pagelas', async () => {
      await expect(
        createService.create(createDto, outsider),
      ).rejects.toBeInstanceOf(AppForbiddenException);
    });
  });

  describe('edição', () => {
    it('recalcula a semana ao mudar a data de referência', async () => {
      await updateService.update(
        'pagela-1',
        { referenceDate: '2026-04-04' },
        admin,
      );

      expect(weekService.resolve).toHaveBeenCalledWith('2026-04-04', false);
      expect(repo.updateOne).toHaveBeenCalledWith(
        'pagela-1',
        expect.objectContaining({ year: 2026, week: 5 }),
      );
    });

    it('mantém semana e ano quando a nova data está fora do período', async () => {
      weekService.resolve.mockResolvedValue(null);

      await updateService.update(
        'pagela-1',
        { referenceDate: '2030-01-01' },
        admin,
      );

      expect(repo.updateOne).toHaveBeenCalledWith(
        'pagela-1',
        expect.objectContaining({ year: undefined, week: undefined }),
      );
    });

    it('leva o nulo adiante para limpar a observação', async () => {
      await updateService.update('pagela-1', { notes: null }, admin);

      expect(repo.updateOne).toHaveBeenCalledWith(
        'pagela-1',
        expect.objectContaining({ notes: null }),
      );
    });

    it('não edita pagela fora do alcance de quem pede', async () => {
      repo.findOneInScope.mockResolvedValue(null);

      await expect(
        updateService.update('pagela-1', { present: false }, coordinator),
      ).rejects.toBeInstanceOf(AppNotFoundException);

      expect(repo.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('exclusão', () => {
    it('apaga a pagela do próprio alcance', async () => {
      await deleteService.remove('pagela-1', coordinator);

      expect(repo.deleteById).toHaveBeenCalledWith('pagela-1');
    });

    it('não apaga pagela fora do alcance de quem pede', async () => {
      repo.findOneInScope.mockResolvedValue(null);

      await expect(
        deleteService.remove('pagela-1', coordinator),
      ).rejects.toBeInstanceOf(AppNotFoundException);

      expect(repo.deleteById).not.toHaveBeenCalled();
    });

    it('recusa quem não trabalha com pagelas', async () => {
      await expect(
        deleteService.remove('pagela-1', outsider),
      ).rejects.toBeInstanceOf(AppForbiddenException);
    });
  });
});
