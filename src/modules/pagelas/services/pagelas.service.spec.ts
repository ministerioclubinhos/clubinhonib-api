import {
  AppBusinessException,
  AppForbiddenException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';

import { PagelasRepository } from '../repositories/pagelas.repository';
import { PagelaEntity } from '../entities/pagela.entity';
import { CreatePagelasService } from './create-pagelas.service';
import { GetPagelasService } from './get-pagelas.service';
import { UpdatePagelasService } from './update-pagelas.service';
import { DeletePagelasService } from './delete-pagelas.service';
import { PagelaLaunchWindowService } from './pagela-launch-window.service';

type RepoMock = jest.Mocked<
  Pick<
    PagelasRepository,
    | 'findAll'
    | 'findAllPaginated'
    | 'findOneInScope'
    | 'childIsWithinReach'
    | 'childIsActive'
    | 'createOne'
    | 'updateOne'
    | 'deleteById'
  >
>;

type WeekMock = jest.Mocked<
  Pick<PagelaLaunchWindowService, 'resolveForCreation' | 'resolveForUpdate'>
>;

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
      childIsActive: jest.fn().mockResolvedValue(true),
      createOne: jest.fn().mockResolvedValue(pagela()),
      updateOne: jest.fn().mockResolvedValue(pagela()),
      deleteById: jest.fn().mockResolvedValue(undefined),
    } as unknown as RepoMock;

    weekService = {
      resolveForCreation: jest.fn().mockResolvedValue({ year: 2026, week: 5 }),
      resolveForUpdate: jest.fn().mockResolvedValue(null),
    } as unknown as WeekMock;

    getService = new GetPagelasService(repo as unknown as PagelasRepository);
    createService = new CreatePagelasService(
      repo as unknown as PagelasRepository,
      weekService as unknown as PagelaLaunchWindowService,
    );
    updateService = new UpdatePagelasService(
      repo as unknown as PagelasRepository,
      getService,
      weekService as unknown as PagelaLaunchWindowService,
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
    it('grava a semana e o ano que a janela de lançamento devolve', async () => {
      await createService.create(createDto, admin);

      expect(weekService.resolveForCreation).toHaveBeenCalledWith(createDto);
      expect(repo.createOne).toHaveBeenCalledWith(
        expect.objectContaining({ year: 2026, week: 5 }),
      );
    });

    it('não grava nada quando o período letivo está fechado', async () => {
      weekService.resolveForCreation.mockRejectedValue(
        new AppBusinessException(ErrorCode.ACADEMIC_PERIOD_CLOSED, 'fechado'),
      );

      await expect(
        createService.create({ ...createDto, week: 9, year: 2026 }, admin),
      ).rejects.toBeInstanceOf(AppBusinessException);

      expect(repo.createOne).not.toHaveBeenCalled();
    });

    it('não lança pagela para criança desativada', async () => {
      repo.childIsActive.mockResolvedValue(false);

      await expect(
        createService.create(createDto, admin),
      ).rejects.toMatchObject({ code: ErrorCode.CHILD_INACTIVE });

      expect(repo.createOne).not.toHaveBeenCalled();
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
    it('grava a nova semana quando a janela aceita a mudança', async () => {
      weekService.resolveForUpdate.mockResolvedValue({ year: 2026, week: 9 });

      await updateService.update(
        'pagela-1',
        { referenceDate: '2026-04-04' },
        admin,
      );

      expect(weekService.resolveForUpdate).toHaveBeenCalledWith(
        { referenceDate: '2026-04-04' },
        { year: 2026, week: 5, referenceDate: '2026-03-07' },
      );
      expect(repo.updateOne).toHaveBeenCalledWith(
        'pagela-1',
        expect.objectContaining({ year: 2026, week: 9 }),
      );
    });

    it('não mexe em semana e ano quando a edição não os muda', async () => {
      await updateService.update('pagela-1', { present: false }, admin);

      expect(repo.updateOne).toHaveBeenCalledWith(
        'pagela-1',
        expect.objectContaining({ year: undefined, week: undefined }),
      );
    });

    it('não edita nada quando o período letivo está fechado', async () => {
      weekService.resolveForUpdate.mockRejectedValue(
        new AppBusinessException(ErrorCode.ACADEMIC_PERIOD_CLOSED, 'fechado'),
      );

      await expect(
        updateService.update('pagela-1', { present: false }, admin),
      ).rejects.toBeInstanceOf(AppBusinessException);

      expect(repo.updateOne).not.toHaveBeenCalled();
    });

    it('não edita pagela de criança desativada', async () => {
      repo.childIsActive.mockResolvedValue(false);

      await expect(
        updateService.update('pagela-1', { present: false }, admin),
      ).rejects.toMatchObject({ code: ErrorCode.CHILD_INACTIVE });

      expect(repo.updateOne).not.toHaveBeenCalled();
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
