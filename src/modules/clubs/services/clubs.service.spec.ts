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
    | 'findCurrentClubIdsOfTeachers'
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
      // Existia para conferir de onde vinha cada professor. Continua no mock
      // para os testes provarem que ninguém mais o chama.
      findCurrentClubIdsOfTeachers: jest.fn().mockResolvedValue(new Map()),
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

    it('o coordenador cria o clubinho já com qualquer professor', async () => {
      await createService.create(
        {
          number: 12,
          weekday: Weekday.SATURDAY,
          teacherProfileIds: ['t-de-outra-coordenacao'],
        },
        coordinator,
      );

      expect(repo.createClub).toHaveBeenCalled();
      expect(repo.findCurrentClubIdsOfTeachers).not.toHaveBeenCalled();
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

    /**
     * O que o coordenador decide sozinho no clubinho dele.
     *
     * São as duas operações do dia a dia da coordenação: quando o clubinho se
     * reúne e quem dá aula nele. Nenhuma delas passa por administrador.
     */
    describe('o que o coordenador pode no clubinho dele', () => {
      it('muda o dia da semana', async () => {
        await updateService.update(
          'club-1',
          { weekday: Weekday.FRIDAY },
          coordinator,
        );

        expect(repo.updateClub).toHaveBeenCalledWith('club-1', {
          weekday: Weekday.FRIDAY,
        });
      });

      it('muda o horário', async () => {
        await updateService.update('club-1', { time: '16:30' }, coordinator);

        expect(repo.updateClub).toHaveBeenCalledWith('club-1', {
          time: '16:30',
        });
      });

      it('mudar o dia leva a alteração para o calendário', async () => {
        // A série inteira muda de dia, e é a sincronização que refaz as datas.
        await updateService.update(
          'club-1',
          { weekday: Weekday.FRIDAY },
          coordinator,
        );

        expect(sync.syncFromClub).toHaveBeenCalledWith(club());
      });

      it('monta a equipe com qualquer professor, venha de onde vier', async () => {
        // Vincular move o vínculo: o professor sai do clubinho anterior, mesmo
        // que seja de outra coordenação. O coordenador é dono da equipe do
        // clubinho dele.
        await updateService.update(
          'club-1',
          { teacherProfileIds: ['t-de-outra-coordenacao'] },
          coordinator,
        );

        expect(repo.updateClub).toHaveBeenCalledWith('club-1', {
          teacherProfileIds: ['t-de-outra-coordenacao'],
        });
      });

      it('remove um professor deixando-o fora da lista', async () => {
        await updateService.update(
          'club-1',
          { teacherProfileIds: [] },
          coordinator,
        );

        expect(repo.updateClub).toHaveBeenCalledWith('club-1', {
          teacherProfileIds: [],
        });
      });

      it('não consulta o clubinho atual dos professores', async () => {
        // A conferência antiga custava duas consultas por edição e barrava
        // quem viesse de outra coordenação.
        await updateService.update(
          'club-1',
          { teacherProfileIds: ['t-1', 't-2'] },
          coordinator,
        );

        expect(repo.findCurrentClubIdsOfTeachers).not.toHaveBeenCalled();
      });
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
    it('tira os dias do calendário antes de apagar o clubinho', async () => {
      // Depois da exclusão não há mais vínculo de onde partir.
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

    it('recusa o coordenador, mesmo no clubinho que ele coordena', async () => {
      // É a única operação de clubinho fechada para a coordenação, e a razão é
      // ser a única irreversível: a linha some e as crianças são desvinculadas.
      // Para tirar o clubinho do ar com volta, existe desativar.
      repo.userHasAccessToClub.mockResolvedValue(true);

      await expect(
        deleteService.remove('club-1', coordinator),
      ).rejects.toBeInstanceOf(AppForbiddenException);

      expect(sync.removeForClub).not.toHaveBeenCalled();
      expect(repo.deleteById).not.toHaveBeenCalled();
    });

    it('o coordenador continua podendo desativar o clubinho dele', async () => {
      // A alternativa com volta: some do calendário, o histórico fica.
      repo.findOneOrFailForResponse.mockResolvedValue(club({ isActive: true }));
      repo.updateClub.mockResolvedValue(club({ isActive: false }));

      await updateService.toggleActive('club-1', coordinator);

      expect(repo.updateClub).toHaveBeenCalledWith('club-1', {
        isActive: false,
      });
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
