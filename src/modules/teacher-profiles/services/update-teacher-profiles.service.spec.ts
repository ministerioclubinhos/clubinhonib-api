import { Test } from '@nestjs/testing';

import { AccessContext, UserRole } from 'src/core/auth/auth.types';
import { AppForbiddenException } from 'src/shared/exceptions';

import { TeacherProfilesRepository } from '../repositories/teacher-profiles.repository';
import { UpdateTeacherProfilesService } from './update-teacher-profiles.service';

describe('UpdateTeacherProfilesService', () => {
  const repo = {
    assignTeacherToClub: jest.fn(),
    unassignTeacherFromClub: jest.fn(),
    userHasAccessToClub: jest.fn(),
    findOneWithClubAndCoordinatorOrFail: jest.fn(),
    setActiveByUserId: jest.fn(),
    linkTeacherToClubByNumber: jest.fn(),
  };

  const admin: AccessContext = { role: UserRole.ADMIN, userId: 'admin-1' };
  const coordinator: AccessContext = {
    role: UserRole.COORDINATOR,
    userId: 'coord-user-1',
  };
  const teacher: AccessContext = { role: UserRole.TEACHER, userId: 'user-1' };

  const buildService = async (): Promise<UpdateTeacherProfilesService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateTeacherProfilesService,
        { provide: TeacherProfilesRepository, useValue: repo },
      ],
    }).compile();

    return moduleRef.get(UpdateTeacherProfilesService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.userHasAccessToClub.mockResolvedValue(true);
    repo.findOneWithClubAndCoordinatorOrFail.mockResolvedValue({
      id: 'teacher-1',
      club: { id: 'club-1' },
    });
  });

  describe('assignClub', () => {
    it('barra o professor', async () => {
      const service = await buildService();

      await expect(
        service.assignClub(teacher, 'teacher-1', 'club-1'),
      ).rejects.toBeInstanceOf(AppForbiddenException);
      expect(repo.assignTeacherToClub).not.toHaveBeenCalled();
    });

    it('o administrador não passa pela checagem de escopo', async () => {
      const service = await buildService();

      await service.assignClub(admin, 'teacher-1', 'club-9');

      expect(repo.userHasAccessToClub).not.toHaveBeenCalled();
      expect(repo.assignTeacherToClub).toHaveBeenCalledWith(
        'teacher-1',
        'club-9',
      );
    });

    it('o coordenador só vincula a clubinhos que coordena', async () => {
      repo.userHasAccessToClub.mockResolvedValue(false);
      const service = await buildService();

      await expect(
        service.assignClub(coordinator, 'teacher-1', 'club-9'),
      ).rejects.toBeInstanceOf(AppForbiddenException);
      expect(repo.assignTeacherToClub).not.toHaveBeenCalled();
    });

    /**
     * Vincular move o professor entre clubinhos. Sem checar a turma atual, um
     * coordenador puxaria um professor da coordenação alheia para a dele.
     */
    it('o coordenador não tira um professor de um clubinho que não coordena', async () => {
      repo.findOneWithClubAndCoordinatorOrFail.mockResolvedValue({
        id: 'teacher-1',
        club: { id: 'club-de-outro' },
      });
      repo.userHasAccessToClub.mockImplementation((clubId: string) =>
        Promise.resolve(clubId === 'club-meu'),
      );
      const service = await buildService();

      await expect(
        service.assignClub(coordinator, 'teacher-1', 'club-meu'),
      ).rejects.toBeInstanceOf(AppForbiddenException);
      expect(repo.assignTeacherToClub).not.toHaveBeenCalled();
    });

    it('o coordenador move um professor entre clubinhos que coordena', async () => {
      repo.findOneWithClubAndCoordinatorOrFail.mockResolvedValue({
        id: 'teacher-1',
        club: { id: 'club-1' },
      });
      const service = await buildService();

      await service.assignClub(coordinator, 'teacher-1', 'club-2');

      expect(repo.assignTeacherToClub).toHaveBeenCalledWith(
        'teacher-1',
        'club-2',
      );
    });

    it('não checa a turma atual de quem ainda não tem clubinho', async () => {
      repo.findOneWithClubAndCoordinatorOrFail.mockResolvedValue({
        id: 'teacher-1',
        club: null,
      });
      const service = await buildService();

      await service.assignClub(coordinator, 'teacher-1', 'club-2');

      expect(repo.userHasAccessToClub).toHaveBeenCalledTimes(1);
      expect(repo.assignTeacherToClub).toHaveBeenCalled();
    });
  });

  describe('unassignClub', () => {
    /**
     * Sem o clubinho no corpo, o desvínculo vale para o clubinho atual — e é
     * ele que precisa estar sob a coordenação de quem pediu.
     */
    it('checa o clubinho atual quando o corpo não traz nenhum', async () => {
      const service = await buildService();

      await service.unassignClub(coordinator, 'teacher-1', undefined);

      expect(repo.userHasAccessToClub).toHaveBeenCalledWith(
        'club-1',
        coordinator,
      );
      expect(repo.unassignTeacherFromClub).toHaveBeenCalledWith(
        'teacher-1',
        undefined,
      );
    });

    it('recusa quando o professor não tem clubinho', async () => {
      repo.findOneWithClubAndCoordinatorOrFail.mockResolvedValue({
        id: 'teacher-1',
        club: null,
      });
      const service = await buildService();

      await expect(
        service.unassignClub(coordinator, 'teacher-1', undefined),
      ).rejects.toBeInstanceOf(AppForbiddenException);
      expect(repo.unassignTeacherFromClub).not.toHaveBeenCalled();
    });
  });

  describe('setActiveForUser', () => {
    /**
     * Desativar apagava o perfil e o vínculo junto; reativar devolvia um perfil
     * sem turma.
     */
    it('desliga o perfil sem removê-lo', async () => {
      const service = await buildService();

      await service.setActiveForUser('user-1', false);

      expect(repo.setActiveByUserId).toHaveBeenCalledWith('user-1', false);
    });
  });
});
