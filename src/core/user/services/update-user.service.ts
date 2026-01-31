import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { UserRepository } from '../user.repository';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity } from '../entities/user.entity';

import { TeacherProfilesService } from 'src/modules/teacher-profiles/services/teacher-profiles.service';
import { CoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/coordinator-profiles.service';
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
    private teacherProfilesService: TeacherProfilesService,
    private coordinatorProfilesService: CoordinatorProfilesService,
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
    const activeInDto = typeof dto.active === 'boolean';
    const nextActive: boolean = dto.active ?? current.active;

    const willChangeRole = dto.role !== undefined && dto.role !== current.role;

    if (willChangeRole) {
      if (nextRole === UserRole.TEACHER) {
        await this.coordinatorProfilesService.removeByUserId(id);
        if (nextActive) {
          try {
            await this.teacherProfilesService.createForUser(id);
          } catch {
            // Profile may already exist, ignore
          }
        } else {
          await this.teacherProfilesService.removeByUserId(id);
        }
      } else if (nextRole === UserRole.COORDINATOR) {
        await this.teacherProfilesService.removeByUserId(id);
        if (nextActive) {
          try {
            await this.coordinatorProfilesService.createForUser(id);
          } catch {
            // Profile may already exist, ignore
          }
        } else {
          await this.coordinatorProfilesService.removeByUserId(id);
        }
      } else {
        await this.teacherProfilesService.removeByUserId(id);
        await this.coordinatorProfilesService.removeByUserId(id);
      }
    }

    if (!willChangeRole && activeInDto) {
      if (nextRole === UserRole.TEACHER) {
        if (nextActive) {
          try {
            await this.teacherProfilesService.createForUser(id);
          } catch {
            // Profile may already exist, ignore
          }
        } else {
          await this.teacherProfilesService.removeByUserId(id);
        }
      } else if (nextRole === UserRole.COORDINATOR) {
        if (nextActive) {
          try {
            await this.coordinatorProfilesService.createForUser(id);
          } catch {
            // Profile may already exist, ignore
          }
        } else {
          await this.coordinatorProfilesService.removeByUserId(id);
        }
      }
    }
    const user = await this.userRepo.update(id, dto);
    return user;
  }
}
