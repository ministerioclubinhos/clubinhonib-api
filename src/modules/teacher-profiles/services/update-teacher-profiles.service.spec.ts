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
    it('o coordenador traz um professor de qualquer clubinho', async () => {
      // Ele monta a equipe do clubinho dele com quem quiser: vincular move o
      // vínculo, e o professor sai do clubinho anterior.
      repo.findOneWithClubAndCoordinatorOrFail.mockResolvedValue({
        id: 'teacher-1',
        club: { id: 'club-de-outro' },
      });
      repo.userHasAccessToClub.mockImplementation((clubId: string) =>
        Promise.resolve(clubId === 'club-meu'),
      );
      const service = await buildService();

      await service.assignClub(coordinator, 'teacher-1', 'club-meu');

      expect(repo.assignTeacherToClub).toHaveBeenCalledWith(
        'teacher-1',
        'club-meu',
      );
    });

    it('o destino continua tendo que ser um clubinho dele', async () => {
      // O que limita a operação é para onde o professor vai, não de onde vem:
      // ninguém empurra professor para o clubinho de outra coordenação.
      repo.userHasAccessToClub.mockResolvedValue(false);
      const service = await buildService();

      await expect(
        service.assignClub(coordinator, 'teacher-1', 'club-de-outro'),
      ).rejects.toBeInstanceOf(AppForbiddenException);
      expect(repo.assignTeacherToClub).not.toHaveBeenCalled();
    });

    it('não precisa ler a turma atual do professor', async () => {
      // A leitura era filtrada pelo papel: para um professor de outra
      // coordenação ela devolvia 404 e a operação morria antes da regra.
      const service = await buildService();

      await service.assignClub(coordinator, 'teacher-1', 'club-2');

      expect(repo.findOneWithClubAndCoordinatorOrFail).not.toHaveBeenCalled();
      expect(repo.assignTeacherToClub).toHaveBeenCalled();
    });

    it('o coordenador move um professor entre clubinhos que coordena', async () => {
      const service = await buildService();

      await service.assignClub(coordinator, 'teacher-1', 'club-2');

      expect(repo.assignTeacherToClub).toHaveBeenCalledWith(
        'teacher-1',
        'club-2',
      );
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
