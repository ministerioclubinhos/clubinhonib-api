import {
  Injectable,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { UserRepository } from '../user.repository';
import { CreateUserDto } from '../dto/create-user.dto';
import { UserEntity } from '../user.entity';

import { TeacherProfilesService } from 'src/modules/teacher-profiles/services/teacher-profiles.service';
import { CoordinatorProfilesService } from 'src/modules/coordinator-profiles/services/coordinator-profiles.service';
import { UserRole } from 'src/auth/auth.types';

@Injectable()
export class CreateUserService {
  private readonly logger = new Logger(CreateUserService.name);

  constructor(
    private readonly userRepo: UserRepository,
    private readonly teacherService: TeacherProfilesService,
    private readonly coordinatorService: CoordinatorProfilesService,
  ) { }

  async create(dto: CreateUserDto): Promise<UserEntity> {
    this.logger.debug(`Creating user with email: ${dto.email}`);
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
    });

    if (user.role === UserRole.COORDINATOR) {
      await this.coordinatorService.createForUser(user.id);
    } else if (user.role === UserRole.TEACHER) {
      await this.teacherService.createForUser(user.id);
    }
    this.logger.log(`User created: ${user.id}`);
    return user;
  }
}
