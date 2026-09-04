import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { UserRepository } from '../user.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserEntity } from '../entities/user.entity';

import { CreateTeacherProfilesService } from 'src/modules/teacher-profiles/services/create-teacher-profiles.service';
import { UpdateTeacherProfilesService } from 'src/modules/teacher-profiles/services/update-teacher-profiles.service';
import { CreateCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/create-coordinator-profiles.service';
import { UpdateCoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/update-coordinator-profiles.service';
import { UserRole } from 'src/core/auth/auth.types';
import { AppConflictException, ErrorCode } from 'src/shared/exceptions';
import { PASSWORD_SALT_ROUNDS } from '../constants';

@Injectable()
export class CreateUserService {
  private readonly logger = new Logger(CreateUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly createTeacherProfileService: CreateTeacherProfilesService,
    private readonly updateTeacherProfileService: UpdateTeacherProfilesService,
    private readonly createCoordinatorProfileService: CreateCoordinatorProfilesService,
    private readonly updateCoordinatorProfileService: UpdateCoordinatorProfilesService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existingEmail = await this.userRepo.findByEmail(dto.email);
    if (existingEmail) {
      throw new AppConflictException(
        ErrorCode.EMAIL_ALREADY_IN_USE,
        'Este email já está em uso por outro usuário',
        { field: 'email' },
      );
    }

    if (dto.cpf) {
      const existingCpf = await this.userRepo.findByCpf(dto.cpf);
      if (existingCpf) {
        throw new AppConflictException(
          ErrorCode.RESOURCE_CONFLICT,
          'Este CPF já está em uso por outro usuário',
          { field: 'cpf' },
        );
      }
    }

    const hashedPassword = await bcrypt.hash(
      dto.password,
      PASSWORD_SALT_ROUNDS,
    );
    const user = await this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      phone: dto.phone,
      role: dto.role,
      active: dto.active,
      completed: dto.completed,
      commonUser: dto.commonUser,
      cpf: dto.cpf,
    });

    // O perfil nasce junto com a conta e já espelha a situação dela: criar uma
    // conta inativa deixava um perfil ativo para trás.
    if (user.role === UserRole.COORDINATOR) {
      await this.createCoordinatorProfileService.createForUser(user.id);
      await this.updateCoordinatorProfileService.setActiveForUser(
        user.id,
        user.active,
      );
    } else if (user.role === UserRole.TEACHER) {
      await this.createTeacherProfileService.createForUser(user.id);
      await this.updateTeacherProfileService.setActiveForUser(
        user.id,
        user.active,
      );
    }

    return user;
  }
}
