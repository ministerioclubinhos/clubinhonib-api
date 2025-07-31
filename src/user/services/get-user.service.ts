// src/users/users.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../user.entity';
import { GetUsersQueryDto } from '../dto/get-users-query.dto';
import { UserRepository } from '../user.repository';

@Injectable()
export class GetUsersService {
  private readonly logger = new Logger(GetUsersService.name);

  constructor(private readonly userRepo: UserRepository, @InjectRepository(UserEntity) private readonly repo: Repository<UserEntity>) { }


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

    // mapeia colunas seguras para ordenação
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

    const qb = this.repo.createQueryBuilder('u')
      // seleciona apenas campos não sensíveis
      .select([
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
        // NADA de password/refreshToken
      ]);

    // Busca textual (MySQL): LOWER(col) LIKE LOWER(:like)
    if (term?.trim()) {
      const like = `%${term.trim()}%`;
      qb.andWhere(
        '(LOWER(u.name) LIKE LOWER(:like) OR LOWER(u.email) LIKE LOWER(:like) OR LOWER(u.phone) LIKE LOWER(:like) OR LOWER(u.role) LIKE LOWER(:like))',
        { like },
      );
    }

    if (role) qb.andWhere('u.role = :role', { role });

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
