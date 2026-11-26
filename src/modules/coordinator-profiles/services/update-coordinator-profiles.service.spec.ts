import { Test } from '@nestjs/testing';

import { AccessContext, UserRole } from 'src/core/auth/auth.types';
import { AppForbiddenException } from 'src/shared/exceptions';

import { CoordinatorProfilesRepository } from '../repositories/coordinator-profiles.repository';
import { UpdateCoordinatorProfilesService } from './update-coordinator-profiles.service';

describe('UpdateCoordinatorProfilesService', () => {
  const repo = {
    assignClubToCoordinator: jest.fn(),
    unassignClubFromCoordinator: jest.fn(),
    moveClubBetweenCoordinators: jest.fn(),
    setActiveByUserId: jest.fn(),
  };

  const admin: AccessContext = { role: UserRole.ADMIN, userId: 'admin-1' };
  const coordinator: AccessContext = {
    role: UserRole.COORDINATOR,
    userId: 'coord-user-1',
  };

  const buildService = async (): Promise<UpdateCoordinatorProfilesService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateCoordinatorProfilesService,
        { provide: CoordinatorProfilesRepository, useValue: repo },
      ],
    }).compile();

    return moduleRef.get(UpdateCoordinatorProfilesService);
  };

  beforeEach(() => jest.clearAllMocks());

  /**
   * Reorganizar a estrutura é operação de administrador. Antes nenhuma rota do
   * módulo verificava o papel.
   */
  it.each([
    [
      'assignClub',
      (s: UpdateCoordinatorProfilesService, c: AccessContext) =>
        s.assignClub(c, 'coord-1', 'club-1'),
    ],
    [
      'unassignClub',
      (s: UpdateCoordinatorProfilesService, c: AccessContext) =>
        s.unassignClub(c, 'coord-1', 'club-1'),
    ],
    [
      'moveClub',
      (s: UpdateCoordinatorProfilesService, c: AccessContext) =>
        s.moveClub(c, 'coord-1', 'club-1', 'coord-2'),
    ],
  ])('barra o coordenador em %s', async (_name, call) => {
    const service = await buildService();

    await expect(call(service, coordinator)).rejects.toBeInstanceOf(
      AppForbiddenException,
    );
    expect(repo.assignClubToCoordinator).not.toHaveBeenCalled();
    expect(repo.unassignClubFromCoordinator).not.toHaveBeenCalled();
    expect(repo.moveClubBetweenCoordinators).not.toHaveBeenCalled();
  });

  it('deixa o administrador vincular, desvincular e transferir', async () => {
    const service = await buildService();

    await service.assignClub(admin, 'coord-1', 'club-1');
    await service.unassignClub(admin, 'coord-1', 'club-1');
    await service.moveClub(admin, 'coord-1', 'club-1', 'coord-2');

    expect(repo.assignClubToCoordinator).toHaveBeenCalledWith(
      'coord-1',
      'club-1',
    );
    expect(repo.unassignClubFromCoordinator).toHaveBeenCalledWith(
      'coord-1',
      'club-1',
    );
    expect(repo.moveClubBetweenCoordinators).toHaveBeenCalledWith(
      'coord-1',
      'club-1',
      'coord-2',
    );
  });

  it('desliga o perfil sem removê-lo, preservando os clubinhos', async () => {
    const service = await buildService();

    await service.setActiveForUser('user-1', false);

    expect(repo.setActiveByUserId).toHaveBeenCalledWith('user-1', false);
  });
});
