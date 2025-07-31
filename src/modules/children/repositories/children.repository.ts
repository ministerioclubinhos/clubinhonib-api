// src/modules/children/repositories/children.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ChildEntity } from '../entities/child.entity';
import { QueryChildrenDto, QueryChildrenSimpleDto } from '../dto/query-children.dto';

export type PaginatedRows<T> = { items: T[]; total: number };

@Injectable()
export class ChildrenRepository {
  constructor(
    @InjectRepository(ChildEntity)
    private readonly repo: Repository<ChildEntity>,
  ) {}

  private baseQB(): SelectQueryBuilder<ChildEntity> {
    return this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.club', 'club')
      .leftJoinAndSelect('c.address', 'addr');
  }

  async findAllPaginated(q: QueryChildrenDto): Promise<PaginatedRows<ChildEntity>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;

    const qb = this.baseQB();

    // searchString: name / guardianName (MySQL: usar LOWER + LIKE)
    if (q.searchString) {
      const s = `%${q.searchString.trim().toLowerCase()}%`;
      qb.andWhere('(LOWER(c.name) LIKE :s OR LOWER(c.guardianName) LIKE :s)', { s });
    }

    // clubNumber tem precedência; se não vier, clubId continua funcionando
    if (q.clubNumber !== undefined) {
      qb.andWhere('club.number = :clubNumber', { clubNumber: q.clubNumber });
    } else if (q.clubId) {
      qb.andWhere('club.id = :clubId', { clubId: q.clubId });
    }

    // filtros por endereço
    if (q.city) qb.andWhere('LOWER(addr.city) LIKE :city', { city: `%${q.city.toLowerCase()}%` });
    if (q.state) qb.andWhere('LOWER(addr.state) LIKE :state', { state: `%${q.state.toLowerCase()}%` });

    // filtros de birthDate
    if (q.birthDate) qb.andWhere('c.birthDate = :b', { b: q.birthDate });
    if (q.birthDateFrom) qb.andWhere('c.birthDate >= :bf', { bf: q.birthDateFrom });
    if (q.birthDateTo) qb.andWhere('c.birthDate <= :bt', { bt: q.birthDateTo });

    // filtros de joinedAt
    if (q.joinedAt) qb.andWhere('c.joinedAt = :j', { j: q.joinedAt });
    if (q.joinedFrom) qb.andWhere('c.joinedAt >= :jf', { jf: q.joinedFrom });
    if (q.joinedTo) qb.andWhere('c.joinedAt <= :jt', { jt: q.joinedTo });

    const orderByMap: Record<string, string> = {
      name: 'c.name',
      birthDate: 'c.birthDate',
      joinedAt: 'c.joinedAt',
      createdAt: 'c.createdAt',
    };
    const orderBy = orderByMap[q.orderBy ?? 'name'] ?? 'c.name';
    const order: 'ASC' | 'DESC' = (q.order ?? 'ASC').toUpperCase() as any;

    qb.orderBy(orderBy, order).skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findAllSimple(q: QueryChildrenSimpleDto): Promise<ChildEntity[]> {
    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoin('c.club', 'club')
      .select(['c.id', 'c.name', 'c.guardianName', 'c.guardianPhone', 'club.id'])
      .limit(q.limit ?? 20);

    if (q.searchString) {
      const s = `%${q.searchString.trim().toLowerCase()}%`;
      qb.where('LOWER(c.name) LIKE :s OR LOWER(c.guardianName) LIKE :s', { s });
    }

    return qb.getMany();
  }

  async findOneOrFailForResponse(id: string): Promise<ChildEntity | null> {
    return this.baseQB().where('c.id = :id', { id }).getOne();
  }

  create(partial: Partial<ChildEntity>): ChildEntity {
    return this.repo.create(partial);
  }

  merge(target: ChildEntity, partial: Partial<ChildEntity>): ChildEntity {
    return this.repo.merge(target, partial);
  }

  save(entity: ChildEntity): Promise<ChildEntity> {
    return this.repo.save(entity);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
