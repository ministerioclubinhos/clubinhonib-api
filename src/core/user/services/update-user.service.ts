import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { UserRepository } from '../user.repository';
import { NotifyAccountChangesService } from './notify-account-changes.service';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';

import { CreateTeacherProfilesService } from 'src/modules/teacher-profiles/services/create-teacher-profiles.service';
import { DeleteTeacherProfilesService } from 'src/modules/teacher-profiles/services/delete-teacher-profiles.service';
import { UpdateTeacherProfilesService } from 'src/modules/teacher-profiles/services/update-teacher-profiles.service';
import { CreateCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/create-coordinator-profiles.service';
import { DeleteCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/delete-coordinator-profiles.service';
import { UpdateCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/update-coordinator-profiles.service';
import { UserRole } from 'src/core/auth/auth.types';
import {
  AppNotFoundException,
  AppConflictException,
  ErrorCode,
} from 'src/shared/exceptions';

@Injectable()
export class UpdateUserService {
  private readonly logger = new Logger(UpdateUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly createTeacherProfileService: CreateTeacherProfilesService,
    private readonly updateTeacherProfileService: UpdateTeacherProfilesService,
    private readonly deleteTeacherProfileService: DeleteTeacherProfilesService,
    private readonly createCoordinatorProfileService: CreateCoordinatorProfilesService,
    private readonly updateCoordinatorProfileService: UpdateCoordinatorProfilesService,
    private readonly deleteCoordinatorProfileService: DeleteCoordinatorProfilesService,
    private readonly notifyAccountChanges: NotifyAccountChangesService,
  ) {}

  async update(id: string, dto: Partial<UpdateUserDto>): Promise<UserEntity> {
    const current = await this.userRepo.findById(id);
    if (!current) {
      throw new AppNotFoundException(
        ErrorCode.USER_NOT_FOUND,
        'Usuário não encontrado',
      );
    }

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.email && dto.email !== current.email) {
      const existingUser = await this.userRepo.findByEmail(dto.email);
      if (existingUser && existingUser.id !== id) {
        throw new AppConflictException(
          ErrorCode.EMAIL_ALREADY_IN_USE,
          'Este email já está em uso por outro usuário',
          { field: 'email' },
        );
      }
    }

    if (dto.cpf && dto.cpf !== current.cpf) {
      const existingUser = await this.userRepo.findByCpf(dto.cpf);
      if (existingUser && existingUser.id !== id) {
        throw new AppConflictException(
          ErrorCode.RESOURCE_CONFLICT,
          'Este CPF já está em uso por outro usuário',
          { field: 'cpf' },
        );
      }
    }

    const nextRole: UserRole = dto.role ?? current.role;
    const nextActive: boolean = dto.active ?? current.active;
    const roleChanged = dto.role !== undefined && dto.role !== current.role;
    const activeChanged =
      dto.active !== undefined && dto.active !== current.active;

    if (roleChanged) {
      await this.applyRoleChange(id, nextRole, nextActive);
    } else if (activeChanged) {
      await this.applyActiveChange(id, nextRole, nextActive);
    }

    const previousEmail = current.email;
    const emailChanged = dto.email !== undefined && dto.email !== previousEmail;

    const user = await this.userRepo.update(id, dto);

    this.notifyAboutChanges(user, {
      emailChanged,
      previousEmail,
      roleChanged,
      previousRole: current.role,
      activeChanged,
      nextActive,
    });

    return user;
  }

  /**
   * Conta à pessoa o que a coordenação mudou na conta dela.
   *
   * Os avisos são independentes entre si — diferente de `applyRoleChange` e
   * `applyActiveChange`, que se excluem porque a troca de papel já recria o
   * perfil com o `active` novo. Aqui, quem tem papel **e** acesso alterados na
   * mesma requisição precisa saber das duas coisas: são fatos distintos, e
   * calar um deles deixaria a pessoa sem entender metade do que aconteceu.
   *
   * Nada aqui bloqueia nem propaga: a alteração já está gravada.
   */
  private notifyAboutChanges(
    user: UserEntity,
    changes: {
      emailChanged: boolean;
      previousEmail: string;
      roleChanged: boolean;
      previousRole: UserRole;
      activeChanged: boolean;
      nextActive: boolean;
    },
  ): void {
    if (changes.emailChanged) {
      this.notifyAccountChanges.emailAddressChangedInBackground(
        changes.previousEmail,
        user.name,
        user.email,
      );
    }

    if (changes.roleChanged) {
      this.notifyAccountChanges.roleChangedInBackground(
        user,
        changes.previousRole,
      );
    }

    if (!changes.activeChanged) return;

    if (changes.nextActive) {
      // Liberar um pré-cadastro e reativar uma conta suspensa chegam aqui do
      // mesmo jeito; a mensagem de boas-vindas serve para os dois.
      this.notifyAccountChanges.accountApprovedInBackground(user);
      return;
    }

    this.notifyAccountChanges.accountDeactivatedInBackground(user);
  }

  /**
   * O papel decide qual perfil existe.
   *
   * Trocar de papel remove o perfil antigo — e, com ele, o vínculo com o
   * clubinho, que não faz sentido no papel novo — e cria o do papel novo.
   */
  /**
   * Guarda (ou limpa) o refresh token da sessão.
   *
   * Quem emite o token é o `auth`, mas a coluna é do usuário: o contrato mora
   * aqui para o outro módulo não alcançar o repositório por dentro.
   */
  async updateRefreshToken(
    id: string,
    refreshToken: string | null,
  ): Promise<void> {
    await this.userRepo.updateRefreshToken(id, refreshToken);
  }

  private async applyRoleChange(
    userId: string,
    nextRole: UserRole,
    nextActive: boolean,
  ): Promise<void> {
    if (nextRole === UserRole.TEACHER) {
      await this.deleteCoordinatorProfileService.removeByUserId(userId);
      await this.createTeacherProfileService.createForUser(userId);
      await this.updateTeacherProfileService.setActiveForUser(
        userId,
        nextActive,
      );
      return;
    }

    if (nextRole === UserRole.COORDINATOR) {
      await this.deleteTeacherProfileService.removeByUserId(userId);
      await this.createCoordinatorProfileService.createForUser(userId);
      await this.updateCoordinatorProfileService.setActiveForUser(
        userId,
        nextActive,
      );
      return;
    }

    await this.deleteTeacherProfileService.removeByUserId(userId);
    await this.deleteCoordinatorProfileService.removeByUserId(userId);
  }

  /**
   * Ligar ou desligar a conta acompanha o perfil, mas não o apaga.
   *
   * Antes, desativar apagava o perfil e o vínculo com o clubinho junto; reativar
   * devolvia um perfil sem turma, e a ligação anterior não voltava mais. A
   * criação de usuário sempre manteve o perfil de uma conta inativa, então as
   * duas rotinas discordavam.
   */
  private async applyActiveChange(
    userId: string,
    role: UserRole,
    active: boolean,
  ): Promise<void> {
    if (role === UserRole.TEACHER) {
      await this.createTeacherProfileService.createForUser(userId);
      await this.updateTeacherProfileService.setActiveForUser(userId, active);
      return;
    }

    if (role === UserRole.COORDINATOR) {
      await this.createCoordinatorProfileService.createForUser(userId);
      await this.updateCoordinatorProfileService.setActiveForUser(
        userId,
        active,
      );
    }
  }
}
