// src/user/services/create-user.service.ts
import {
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { UserRepository } from '../user.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserEntity, UserRole } from '../user.entity';

import { TeacherProfilesService } from 'src/modules/teacher-profiles/services/teacher-profiles.service';
import { CoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/coordinator-profiles.service';

@Injectable()
export class CreateUserService {
  private readonly logger = new Logger(CreateUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly teacherService: TeacherProfilesService,
    private readonly coordinatorService: CoordinatorProfilesService,
  ) {}

  async create(dto: CreateUserDto): Promise<UserEntity> {
    this.logger.debug(`Creating user with email: ${dto.email}`);

    // hash da senha
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // flags: todos TRUE conforme sua regra
    const user = await this.userRepo.create({
      email: dto.email,
      password: hashedPassword,
      name: dto.name,
      phone: dto.phone,
      role: dto.role,
      active: dto.active,
      completed: true,
      commonUser: true,
    });

    // cria perfis auxiliares conforme role (sem gerenciar clubs)
    if (user.role === UserRole.COORDINATOR) {
      await this.coordinatorService.createForUser(user.id);
    } else if (user.role === UserRole.TEACHER) {
      await this.teacherService.createForUser(user.id);
    }
    // USER/ADMIN → nenhum perfil extra

    this.logger.log(`User created: ${user.id}`);
    return user;
  }
}
