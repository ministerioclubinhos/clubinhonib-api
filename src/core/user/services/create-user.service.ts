import {
  Injectable,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { UserRepository } from '../user.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserEntity } from '../entities/user.entity';

import { TeacherProfilesService } from 'src/modules/teacher-profiles/services/teacher-profiles.service';
import { CoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/coordinator-profiles.service';
import { UserRole } from 'src/core/auth/auth.types';

@Injectable()
export class CreateUserService {
  private readonly logger = new Logger(CreateUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private teacherProfilesService: TeacherProfilesService,
    private coordinatorProfilesService: CoordinatorProfilesService,
  ) { }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    const existingEmail = await this.userRepo.findByEmail(dto.email);
    if (existingEmail) {
      throw new BadRequestException({ message: 'Este email já está em uso por outro usuário', field: 'email' });
    }

    if (dto.cpf) {
      const existingCpf = await this.userRepo.findByCpf(dto.cpf);
      if (existingCpf) {
        throw new BadRequestException({ message: 'Este CPF já está em uso por outro usuário', field: 'cpf' });
      }
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
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

    if (user.role === UserRole.COORDINATOR) {
      await this.coordinatorProfilesService.createForUser(user.id);
    } else if (user.role === UserRole.TEACHER) {
      await this.teacherProfilesService.createForUser(user.id);
    }
    return user;
  }
}
