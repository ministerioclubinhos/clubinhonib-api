import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async create(user: Partial<UserEntity>): Promise<UserEntity> {
    const newUser = this.repo.create(user);
    return this.repo.save(newUser);
  }

  async findAll(): Promise<UserEntity[]> {
    return this.repo.find();
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email } });
  }

  async findByIdWithProfiles(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: {
        teacherProfile: { club: true },
        coordinatorProfile: { clubs: true },
      },
    });
  }

  async update(id: string, data: Partial<UserEntity>): Promise<UserEntity> {
    await this.repo.update(id, data);
    const updated = await this.findById(id);
    if (!updated) throw new Error('UserEntity not found after update');
    return updated;
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }

  async updateRefreshToken(id: string, refreshToken: string | null): Promise<void> {
    await this.repo.update(id, { refreshToken });
  }
}
