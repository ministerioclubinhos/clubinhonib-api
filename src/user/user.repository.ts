import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { GetUsersQueryDto } from './dto/get-users-query.dto';

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

  async findAllPaginated(q: GetUsersQueryDto) {
    const {
      page = 1,
      limit: rawLimit = 12,
      q: term,
      role,
      active,
      completed,
      sort = 'updatedAt',
      order = 'DESC',
    } = q;

    const limit = Math.min(Math.max(rawLimit, 1), 100);
    const skip = (page - 1) * limit;

    const sortable: Record<string, string> = {
      name: 'u.name',
      email: 'u.email',
      phone: 'u.phone',
      role: 'u.role',
      createdAt: 'u.createdAt',
      updatedAt: 'u.updatedAt',
    };
    const sortCol = sortable[sort] ?? 'u.updatedAt';
    const sortDir = (order || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const qb = this.repo.createQueryBuilder('u').select([
      'u.id',
      'u.createdAt',
      'u.updatedAt',
      'u.email',
      'u.phone',
      'u.name',
      'u.active',
      'u.completed',
      'u.commonUser',
      'u.role',
    ]);

    qb.andWhere('LOWER(u.role) <> :adminRole', { adminRole: 'admin' });

    if (term?.trim()) {
      const like = `%${term.trim()}%`;
      qb.andWhere(
        '(LOWER(u.name) LIKE LOWER(:like) OR LOWER(u.email) LIKE LOWER(:like) OR LOWER(u.phone) LIKE LOWER(:like) OR LOWER(u.role) LIKE LOWER(:like))',
        { like },
      );
    }

    if (role) {
      qb.andWhere('u.role = :role', { role });
    }

    if (typeof active === 'string') {
      qb.andWhere('u.active = :active', { active: active === 'true' });
    }

    if (typeof completed === 'string') {
      qb.andWhere('u.completed = :completed', { completed: completed === 'true' });
    }

    qb.orderBy(sortCol, sortDir).skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        sort,
        order: sortDir,
      },
    };
  }
}
