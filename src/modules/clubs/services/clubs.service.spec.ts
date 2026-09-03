import {
  AppForbiddenException,
  AppNotFoundException,
} from 'src/shared/exceptions';
import { SyncClubEventService } from 'src/modules/pages/event-page/services/sync-club-event.service';

import { ClubsRepository } from '../repositories/clubs.repository';
import { ClubEntity } from '../entities/club.entity';
import { Weekday } from '../entities/weekday.enum';
import { CreateClubsService } from './create-clubs.service';
import { GetClubsService } from './get-clubs.service';
import { UpdateClubsService } from './update-clubs.service';
import { DeleteClubsService } from './delete-clubs.service';

type RepoMock = jest.Mocked<
  Pick<
    ClubsRepository,
    | 'createClub'
    | 'updateClub'
    | 'deleteById'
    | 'findOneOrFailForResponse'
    | 'findAllPaginated'
    | 'findAllSimple'
    | 'list'
    | 'userHasAccessToClub'
    | 'getCoordinatorProfileIdByUserId'
  >
>;

type SyncMock = jest.Mocked<
  Pick<SyncClubEventService, 'syncFromClub' | 'removeForClub'>
>;

const CREATED_AT = new Date('2026-01-01T00:00:00Z');
const UPDATED_AT = new Date('2026-01-02T00:00:00Z');

const club = (overrides: Partial<ClubEntity> = {}): ClubEntity =>
  ({
    id: 'club-1',
    number: 12,
    weekday: Weekday.SATURDAY,
    time: '14:30',
    isActive: true,
    address: null,
    coordinator: null,
    teachers: [],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    ...overrides,
  }) as unknown as ClubEntity;

describe('casos de uso de clubinhos', () => {
  let repo: RepoMock;
  let sync: SyncMock;
  let getService: GetClubsService;
  let createService: CreateClubsService;
  let updateService: UpdateClubsService;
  let deleteService: DeleteClubsService;

  const admin = { role: 'admin', userId: 'admin-1' };
  const coordinator = { role: 'coordinator', userId: 'user-1' };
  const teacher = { role: 'teacher', userId: 'user-2' };

  beforeEach(() => {
    repo = {
      createClub: jest.fn().mockResolvedValue(club()),
      updateClub: jest.fn().mockResolvedValue(club()),
      deleteById: jest.fn().mockResolvedValue(undefined),
      findOneOrFailForResponse: jest.fn().mockResolvedValue(club()),
      findAllPaginated: jest
        .fn()
        .mockResolvedValue({ items: [club()], total: 1 }),
      findAllSimple: jest.fn().mockResolvedValue([club()]),
      list: jest.fn().mockResolvedValue([]),
      userHasAccessToClub: jest.fn().mockResolvedValue(true),
      getCoordinatorProfileIdByUserId: jest.fn().mockResolvedValue('coord-1'),
    } as unknown as RepoMock;

    sync = {
      syncFromClub: jest.fn().mockResolvedValue(null),
      removeForClub: jest.fn().mockResolvedValue(undefined),
    } as unknown as SyncMock;

    getService = new GetClubsService(repo as unknown as ClubsRepository);
    createService = new CreateClubsService(
      repo as unknown as ClubsRepository,
      sync as unknown as SyncClubEventService,
    );
    updateService = new UpdateClubsService(
      repo as unknown as ClubsRepository,
      getService,
      sync as unknown as SyncClubEventService,
    );
    deleteService = new DeleteClubsService(
      repo as unknown as ClubsRepository,
      sync as unknown as SyncClubEventService,
    );
  });

  describe('criação', () => {
    it('leva o encontro do clubinho para o calendário', async () => {
      await createService.create(
        { number: 12, weekday: Weekday.SATURDAY },
        admin,
      );

      expect(repo.createClub).toHaveBeenCalled();
      expect(sync.syncFromClub).toHaveBeenCalledWith(club());
    });

    it('recusa quem não administra clubinhos', async () => {
      await expect(
        createService.create(
          { number: 12, weekday: Weekday.SATURDAY },
          teacher,
        ),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(repo.createClub).not.toHaveBeenCalled();
    });

    it('força o coordenador a criar sob a própria coordenação', async () => {
      const dto = {
        number: 12,
        weekday: Weekday.SATURDAY,
        coordinatorProfileId: 'outro-coord',
      };

      await createService.create(dto, coordinator);

      expect(dto.coordinatorProfileId).toBe('coord-1');
    });
  });

  describe('edição', () => {
    it('sincroniza o calendário depois de salvar', async () => {
      await updateService.update('club-1', { time: '15:00' }, admin);

      expect(repo.updateClub).toHaveBeenCalledWith('club-1', { time: '15:00' });
      expect(sync.syncFromClub).toHaveBeenCalledWith(club());
    });

    it('esconde o clubinho de outra coordenação', async () => {
      repo.userHasAccessToClub.mockResolvedValue(false);

      await expect(
        updateService.update('club-1', { time: '15:00' }, coordinator),
      ).rejects.toBeInstanceOf(AppNotFoundException);

      expect(repo.updateClub).not.toHaveBeenCalled();
    });

    it('impede o coordenador de passar o clubinho para outra coordenação', async () => {
      await expect(
        updateService.update(
          'club-1',
          { coordinatorProfileId: 'outro-coord' },
          coordinator,
        ),
      ).rejects.toBeInstanceOf(AppForbiddenException);
    });
  });

  describe('ativar e desativar', () => {
    it('inverte a situação e reflete no calendário', async () => {
      repo.findOneOrFailForResponse.mockResolvedValue(club({ isActive: true }));
      repo.updateClub.mockResolvedValue(club({ isActive: false }));

      const response = await updateService.toggleActive('club-1', admin);

      expect(repo.updateClub).toHaveBeenCalledWith('club-1', {
        isActive: false,
      });
      // Sem esta linha, desativar o clubinho deixava o encontro no calendário.
      expect(sync.syncFromClub).toHaveBeenCalledWith(club({ isActive: false }));
      expect(response.isActive).toBe(false);
    });
  });

  describe('exclusão', () => {
    it('tira o encontro do calendário antes de apagar o clubinho', async () => {
      const order: string[] = [];
      sync.removeForClub.mockImplementation(() => {
        order.push('evento');
        return Promise.resolve();
      });
      repo.deleteById.mockImplementation(() => {
        order.push('clubinho');
        return Promise.resolve();
      });

      await deleteService.remove('club-1', admin);

      expect(order).toEqual(['evento', 'clubinho']);
    });

    it('recusa quem não administra clubinhos', async () => {
      await expect(
        deleteService.remove('club-1', teacher),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(repo.deleteById).not.toHaveBeenCalled();
    });

    it('esconde o clubinho de outra coordenação', async () => {
      repo.userHasAccessToClub.mockResolvedValue(false);

      await expect(
        deleteService.remove('club-1', coordinator),
      ).rejects.toBeInstanceOf(AppNotFoundException);

      expect(sync.removeForClub).not.toHaveBeenCalled();
      expect(repo.deleteById).not.toHaveBeenCalled();
    });
  });

  describe('leitura', () => {
    it('a listagem paginada é só para quem administra clubinhos', async () => {
      await expect(
        getService.findAllPaginated({}, teacher),
      ).rejects.toBeInstanceOf(AppForbiddenException);
    });

    it('falha quando o clubinho não está no alcance de quem pede', async () => {
      repo.findOneOrFailForResponse.mockResolvedValue(null);

      await expect(
        getService.findOne('club-1', coordinator),
      ).rejects.toBeInstanceOf(AppNotFoundException);
    });
  });
});
