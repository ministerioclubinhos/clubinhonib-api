import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { ChildEntity } from '../entities/child.entity';
import {
  QueryChildrenDto,
  QueryChildrenSimpleDto,
} from '../dto/query-children.dto';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity';
import { AccessContext, UserRole } from 'src/core/auth/auth.types';

import {
  CHILDREN_DEFAULT_LIMIT,
  CHILDREN_DEFAULT_PAGE,
  CHILDREN_DEFAULT_SORT,
  CHILDREN_MAX_LIMIT,
  CHILD_DECIDED_DECISIONS,
  CHILD_SORT_COLUMNS,
  ChildSortField,
  SortOrder,
} from '../constants';

/** Uma página de crianças, como o banco a devolve. */
export interface PaginatedRows<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

/** Uma página ordenada, com a ordenação efetivamente aplicada. */
export interface SortedPaginatedRows<T> extends PaginatedRows<T> {
  orderBy: ChildSortField;
  order: SortOrder;
}

@Injectable()
export class ChildrenRepository {
  constructor(
    @InjectRepository(ChildEntity)
    private readonly repo: Repository<ChildEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubRepo: Repository<ClubEntity>,
  ) {}

  private baseQB(): SelectQueryBuilder<ChildEntity> {
    return this.repo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.club', 'club')
      .leftJoinAndSelect('c.address', 'addr');
  }
  private applyRoleFilter(
    qb: SelectQueryBuilder<ChildEntity>,
    ctx?: AccessContext,
  ): void {
    const role = ctx?.role;
    const userId = ctx?.userId;
    if (!role || role === UserRole.ADMIN || !userId) return;

    if (role === UserRole.COORDINATOR) {
      qb.leftJoin('club.coordinator', 'coord')
        .leftJoin('coord.user', 'coordUser')
        .andWhere('(coordUser.id = :uid OR c.club_id IS NULL)', { uid: userId })
        .distinct(true);
    } else if (role === UserRole.TEACHER) {
      qb.leftJoin('club.teachers', 'tprof')
        .leftJoin('tprof.user', 'tuser')
        .andWhere('(tuser.id = :uid OR c.club_id IS NULL)', { uid: userId })
        .distinct(true);
    }
  }

  async findAllPaginated(
    q: QueryChildrenDto,
    ctx?: AccessContext,
  ): Promise<SortedPaginatedRows<ChildEntity>> {
    const page = q.page ?? CHILDREN_DEFAULT_PAGE;
    const limit = Math.min(
      Math.max(q.limit ?? CHILDREN_DEFAULT_LIMIT, 1),
      CHILDREN_MAX_LIMIT,
    );

    const qb = this.baseQB();

    if (q.searchString) {
      const s = `%${q.searchString.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(c.name) LIKE :s OR LOWER(c.guardianName) LIKE :s OR c.guardianPhone LIKE :s)',
        { s },
      );
    }

    if (q.clubNumber !== undefined) {
      qb.andWhere('club.number = :clubNumber', { clubNumber: q.clubNumber });
    } else if (q.clubId) {
      qb.andWhere('club.id = :clubId', { clubId: q.clubId });
    }

    if (q.city)
      qb.andWhere('LOWER(addr.city) LIKE :city', {
        city: `%${q.city.toLowerCase()}%`,
      });
    if (q.state)
      qb.andWhere('LOWER(addr.state) LIKE :state', {
        state: `%${q.state.toLowerCase()}%`,
      });

    if (q.birthDate) qb.andWhere('c.birthDate = :b', { b: q.birthDate });
    if (q.birthDateFrom)
      qb.andWhere('c.birthDate >= :bf', { bf: q.birthDateFrom });
    if (q.birthDateTo) qb.andWhere('c.birthDate <= :bt', { bt: q.birthDateTo });

    if (q.joinedAt) qb.andWhere('c.joinedAt = :j', { j: q.joinedAt });
    if (q.joinedFrom) qb.andWhere('c.joinedAt >= :jf', { jf: q.joinedFrom });
    if (q.joinedTo) qb.andWhere('c.joinedAt <= :jt', { jt: q.joinedTo });

    if (q.isActive !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive: q.isActive });
    } else if (q.clubNumber !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive: true });
    }

    this.applyRoleFilter(qb, ctx);

    // Só um nome da tabela de colunas chega ao SQL; o valor recebido nunca é
    // interpolado.
    const orderBy = q.orderBy ?? CHILDREN_DEFAULT_SORT;
    const order = q.order === SortOrder.DESC ? SortOrder.DESC : SortOrder.ASC;
    const orderColumn =
      CHILD_SORT_COLUMNS[orderBy] ?? CHILD_SORT_COLUMNS[CHILDREN_DEFAULT_SORT];

    // O desempate por id mantém a paginação estável quando duas linhas têm o
    // mesmo valor na coluna ordenada.
    qb.orderBy(orderColumn, order)
      .addOrderBy('c.id', SortOrder.ASC)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, limit, orderBy, order };
  }

  async findAllSimple(
    q: QueryChildrenSimpleDto,
    ctx?: AccessContext,
  ): Promise<PaginatedRows<ChildEntity>> {
    const page = q.page ?? CHILDREN_DEFAULT_PAGE;
    const limit = Math.min(
      Math.max(q.limit ?? CHILDREN_DEFAULT_LIMIT, 1),
      CHILDREN_MAX_LIMIT,
    );

    const qb = this.repo
      .createQueryBuilder('c')
      .leftJoin('c.club', 'club')
      .leftJoin('c.acceptedChrists', 'acceptedChrists')
      .select([
        'c.id',
        'c.name',
        'c.guardianName',
        'c.guardianPhone',
        'c.gender',
        'c.isActive',
        'club.id',
        'acceptedChrists.id',
        'acceptedChrists.decision',
        'acceptedChrists.createdAt',
        'acceptedChrists.updatedAt',
      ]);

    if (q.searchString) {
      const s = `%${q.searchString.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(c.name) LIKE :s OR LOWER(c.guardianName) LIKE :s OR c.guardianPhone LIKE :s)',
        { s },
      );
    }

    if (q.isActive !== undefined) {
      qb.andWhere('c.isActive = :isActive', { isActive: q.isActive });
    }
    if (q.acceptedChrist !== undefined) {
      if (q.acceptedChrist) {
        qb.andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from('accepted_christs', 'ac')
            .where('ac.child_id = c.id')
            .andWhere('ac.decision IN (:...decisions)', {
              decisions: CHILD_DECIDED_DECISIONS,
            })
            .getQuery();
          return `EXISTS ${subQuery}`;
        });
      } else {
        qb.andWhere((qb) => {
          const subQuery = qb
            .subQuery()
            .select('1')
            .from('accepted_christs', 'ac')
            .where('ac.child_id = c.id')
            .andWhere('ac.decision IN (:...decisions)', {
              decisions: CHILD_DECIDED_DECISIONS,
            })
            .getQuery();
          return `NOT EXISTS ${subQuery}`;
        });
      }
    }

    this.applyRoleFilter(qb as unknown as SelectQueryBuilder<ChildEntity>, ctx);

    qb.orderBy('c.isActive', SortOrder.DESC)
      .addOrderBy('c.name', SortOrder.ASC)
      .addOrderBy('c.id', SortOrder.ASC);

    qb.distinct(true);

    const totalQuery = qb.clone();
    const total = await totalQuery.getCount();

    qb.skip((page - 1) * limit).take(limit);

    const items = await qb.getMany();
    return { items, total, page, limit };
  }

  async findOneForResponse(
    id: string,
    ctx?: AccessContext,
  ): Promise<ChildEntity | null> {
    const qb = this.baseQB().where('c.id = :id', { id });
    this.applyRoleFilter(qb, ctx);
    return qb.getOne();
  }

  async userHasAccessToClub(
    clubId: string,
    ctx?: AccessContext,
  ): Promise<boolean> {
    const role = ctx?.role;
    const userId = ctx?.userId;
    if (!role || role === UserRole.ADMIN) return true;
    if (!userId) return false;

    const qb = this.clubRepo
      .createQueryBuilder('club')
      .where('club.id = :clubId', { clubId });

    if (role === UserRole.COORDINATOR) {
      qb.leftJoin('club.coordinator', 'coord')
        .leftJoin('coord.user', 'coordUser')
        .andWhere('coordUser.id = :uid', { uid: userId });
    } else if (role === UserRole.TEACHER) {
      qb.leftJoin('club.teachers', 'tprof')
        .leftJoin('tprof.user', 'tuser')
        .andWhere('tuser.id = :uid', { uid: userId });
    } else {
      return false;
    }

    const qbWithExists = qb as SelectQueryBuilder<ClubEntity> & {
      getExists?: () => Promise<boolean>;
    };
    const hasGetExists = typeof qbWithExists.getExists === 'function';
    return hasGetExists
      ? !!(await qbWithExists.getExists())
      : (await qb.getCount()) > 0;
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
