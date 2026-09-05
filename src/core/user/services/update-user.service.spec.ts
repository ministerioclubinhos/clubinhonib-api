import { Test } from '@nestjs/testing';

import { UserRole } from 'src/core/auth/auth.types';
import { CreateCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/create-coordinator-profiles.service';
import { DeleteCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/delete-coordinator-profiles.service';
import { UpdateCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/update-coordinator-profiles.service';
import { CreateTeacherProfilesService } from 'src/modules/teacher-profiles/services/create-teacher-profiles.service';
import { DeleteTeacherProfilesService } from 'src/modules/teacher-profiles/services/delete-teacher-profiles.service';
import { UpdateTeacherProfilesService } from 'src/modules/teacher-profiles/services/update-teacher-profiles.service';

import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../user.repository';
import { UpdateUserService } from './update-user.service';
import { NotifyAccountChangesService } from './notify-account-changes.service';

describe('UpdateUserService · perfis de professor e coordenador', () => {
  const userRepo = {
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findByCpf: jest.fn(),
    update: jest.fn(),
  };
  const createTeacher = { createForUser: jest.fn() };
  const updateTeacher = { setActiveForUser: jest.fn() };
  const deleteTeacher = { removeByUserId: jest.fn() };
  const createCoordinator = { createForUser: jest.fn() };
  const updateCoordinator = { setActiveForUser: jest.fn() };
  const deleteCoordinator = { removeByUserId: jest.fn() };

  const currentUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
    ({
      id: 'user-1',
      email: 'fulano@example.com',
      name: 'Fulano',
      phone: '92999990000',
      role: UserRole.TEACHER,
      active: true,
      completed: true,
      commonUser: false,
      ...overrides,
    }) as UserEntity;

  /** Os avisos são disparados sem `await`; aqui só interessa se saíram. */
  const notifyAccountChanges = {
    emailAddressChangedInBackground: jest.fn(),
    roleChangedInBackground: jest.fn(),
    accountApprovedInBackground: jest.fn(),
    accountDeactivatedInBackground: jest.fn(),
  };

  const buildService = async (): Promise<UpdateUserService> => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        UpdateUserService,
        { provide: UserRepository, useValue: userRepo },
        { provide: CreateTeacherProfilesService, useValue: createTeacher },
        { provide: UpdateTeacherProfilesService, useValue: updateTeacher },
        { provide: DeleteTeacherProfilesService, useValue: deleteTeacher },
        {
          provide: CreateCoordinatorProfilesService,
          useValue: createCoordinator,
        },
        {
          provide: UpdateCoordinatorProfilesService,
          useValue: updateCoordinator,
        },
        {
          provide: DeleteCoordinatorProfilesService,
          useValue: deleteCoordinator,
        },
        {
          provide: NotifyAccountChangesService,
          useValue: notifyAccountChanges,
        },
      ],
    }).compile();

    return moduleRef.get(UpdateUserService);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    userRepo.findById.mockResolvedValue(currentUser());
    userRepo.update.mockImplementation(
      (_id: string, dto: Partial<UserEntity>) =>
        Promise.resolve(currentUser(dto)),
    );
  });

  /**
   * O bug: desativar apagava o perfil, e com ele o vínculo com o clubinho.
   * Reativar criava um perfil novo, sem turma, e a ligação anterior não voltava.
   */
  it('desativar um professor desliga o perfil sem apagá-lo', async () => {
    const service = await buildService();

    await service.update('user-1', { active: false });

    expect(deleteTeacher.removeByUserId).not.toHaveBeenCalled();
    expect(updateTeacher.setActiveForUser).toHaveBeenCalledWith(
      'user-1',
      false,
    );
  });

  it('reativar um professor religa o mesmo perfil', async () => {
    userRepo.findById.mockResolvedValue(currentUser({ active: false }));
    const service = await buildService();

    await service.update('user-1', { active: true });

    expect(deleteTeacher.removeByUserId).not.toHaveBeenCalled();
    expect(updateTeacher.setActiveForUser).toHaveBeenCalledWith('user-1', true);
  });

  it('desativar um coordenador preserva os clubinhos dele', async () => {
    userRepo.findById.mockResolvedValue(
      currentUser({ role: UserRole.COORDINATOR }),
    );
    const service = await buildService();

    await service.update('user-1', { active: false });

    expect(deleteCoordinator.removeByUserId).not.toHaveBeenCalled();
    expect(updateCoordinator.setActiveForUser).toHaveBeenCalledWith(
      'user-1',
      false,
    );
  });

  /** Trocar de papel é outra coisa: o perfil antigo não faz mais sentido. */
  it('trocar de professor para coordenador troca o perfil', async () => {
    const service = await buildService();

    await service.update('user-1', { role: UserRole.COORDINATOR });

    expect(deleteTeacher.removeByUserId).toHaveBeenCalledWith('user-1');
    expect(createCoordinator.createForUser).toHaveBeenCalledWith('user-1');
    expect(updateCoordinator.setActiveForUser).toHaveBeenCalledWith(
      'user-1',
      true,
    );
  });

  it('virar administrador remove os dois perfis', async () => {
    const service = await buildService();

    await service.update('user-1', { role: UserRole.ADMIN });

    expect(deleteTeacher.removeByUserId).toHaveBeenCalledWith('user-1');
    expect(deleteCoordinator.removeByUserId).toHaveBeenCalledWith('user-1');
    expect(createTeacher.createForUser).not.toHaveBeenCalled();
    expect(createCoordinator.createForUser).not.toHaveBeenCalled();
  });

  it('não mexe nos perfis quando nem papel nem situação mudam', async () => {
    const service = await buildService();

    await service.update('user-1', { name: 'Fulano de Tal' });

    expect(createTeacher.createForUser).not.toHaveBeenCalled();
    expect(updateTeacher.setActiveForUser).not.toHaveBeenCalled();
    expect(deleteTeacher.removeByUserId).not.toHaveBeenCalled();
  });

  it('reenviar a mesma situação não mexe nos perfis', async () => {
    const service = await buildService();

    await service.update('user-1', { active: true });

    expect(updateTeacher.setActiveForUser).not.toHaveBeenCalled();
  });
});
