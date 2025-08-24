// src/user/services/update-user.service.ts
import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { UserRepository } from '../user.repository';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UserEntity, UserRole } from '../user.entity';

import { TeacherProfilesService } from 'src/modules/teacher-profiles/services/teacher-profiles.service';
import { CoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/coordinator-profiles.service';

@Injectable()
export class UpdateUserService {
  private readonly logger = new Logger(UpdateUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly teacherService: TeacherProfilesService,
    private readonly coordinatorService: CoordinatorProfilesService,
  ) {}

  async update(id: string, dto: Partial<UpdateUserDto>): Promise<UserEntity> {
    this.logger.debug(`Updating user ID: ${id}`);
    const current = await this.userRepo.findById(id);
    if (!current) throw new NotFoundException('UserEntity not found');

    if (dto.password) {
      dto.password = await bcrypt.hash(dto.password, 10);
    }

    const willChangeRole = !!dto.role && dto.role !== current.role;

    if (willChangeRole && dto.role === UserRole.TEACHER) {
      // virar TEACHER: remove coordinator profile e garante teacher profile
      await this.coordinatorService.removeByUserId(id);
      try {
        await this.teacherService.createForUser(id); // idempotente no repo
      } catch { /* já existe */ }
    }

    if (willChangeRole && dto.role === UserRole.COORDINATOR) {
      // virar COORDINATOR: remove teacher profile e garante coordinator profile
      await this.teacherService.removeByUserId(id);
      try {
        await this.coordinatorService.createForUser(id); // idempotente no repo
      } catch { /* já existe */ }
    }

    if (willChangeRole && (dto.role === UserRole.USER || dto.role === UserRole.ADMIN)) {
      // USER/ADMIN: sem perfis
      await this.teacherService.removeByUserId(id);
      await this.coordinatorService.removeByUserId(id);
    }

    // ⚠️ Sem qualquer gestão de club quando a role não muda

    const user = await this.userRepo.update(id, dto);
    this.logger.log(`User updated: ${id}`);
    return user;
  }
}
