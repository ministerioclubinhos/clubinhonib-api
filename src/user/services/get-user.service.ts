import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { UserEntity } from '../user.entity';
import { GetUsersQueryDto } from '../dto/get-users-query.dto';
import { UserRepository } from '../user.repository';

@Injectable()
export class GetUsersService {
  private readonly logger = new Logger(GetUsersService.name);

  constructor(private readonly userRepo: UserRepository) {}

  async findAllPaginated(q: GetUsersQueryDto) {
    return this.userRepo.findAllPaginated(q);
  }

  async findAlll(): Promise<UserEntity[]> {
    this.logger.debug('Fetching all users');
    return this.userRepo.findAll();
  }

  async findOne(id: string): Promise<UserEntity> {
    this.logger.debug(`Fetching user by ID: ${id}`);
    const user = await this.userRepo.findById(id);
    if (!user) throw new NotFoundException('UserEntity not found');
    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    this.logger.debug(`Fetching user by email: ${email}`);
    return this.userRepo.findByEmail(email);
  }
}
