import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  SelectQueryBuilder,
  EntityManager,
} from 'typeorm';

import { CoordinatorProfileEntity } from '../entities/coordinator-profile.entity/coordinator-profile.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { UserEntity } from 'src/user/user.entity';
import {
  CoordinatorSimpleListDto,
  toCoordinatorSimple,
} from '../dto/coordinator-simple-list.dto';
import { CoordinatorProfilesQueryDto } from '../dto/coordinator-profiles.query.dto';

type SortDir = 'ASC' | 'DESC';

@Injectable()
export class CoordinatorProfilesRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CoordinatorProfileEntity)
    private readonly coordRepo: Repository<CoordinatorProfileEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ClubEntity)
    private readonly clubRepo: Repository<ClubEntity>,
  ) {}


  private buildCoordinatorBaseQB(
    manager?: EntityManager,
  ): SelectQueryBuilder<CoordinatorProfileEntity> {
    const repo = manager
      ? manager.getRepository(CoordinatorProfileEntity)
      : this.coordRepo;

    return repo
      .createQueryBuilder('coord')
      .leftJoinAndSelect('coord.clubs', 'club')
      .leftJoinAndSelect('club.teachers', 'teachers')
      .leftJoin('coord.user', 'coord_user')
      .addSelect([
        'coord_user.id',
        'coord_user.name',
        'coord_user.email',
        'coord_user.phone',
        'coord_user.active',
        'coord_user.completed',
        'coord_user.commonUser',
      ])
      .leftJoin('teachers.user', 'teacher_user')
      .addSelect([
        'teacher_user.id',
        'teacher_user.name',
        'teacher_user.email',
        'teacher_user.phone',
        'teacher_user.active',
        'teacher_user.completed',
        'teacher_user.commonUser',
      ])
      .where('coord_user.active = true');
  }

  private baseIdsQuery(): SelectQueryBuilder<CoordinatorProfileEntity> {
    return this.coordRepo
      .createQueryBuilder('coord')
      .leftJoin('coord.user', 'coord_user')
      .where('coord_user.active = true');
  }

  private resolveSort(sort?: string) {
    const map: Record<string, string> = {
      createdAt: 'coord.createdAt',
      updatedAt: 'coord.updatedAt',
      name: 'coord_user.name',
    };
    return map[sort ?? 'updatedAt'] ?? 'coord.updatedAt';
  }

  private coerceClubNumber(input: unknown): number | undefined {
    if (input === undefined || input === null || input === '') return undefined;
    const n = Number(String(input).trim());
    return Number.isInteger(n) ? n : undefined;
  }


  private applyFilters(
    qb: SelectQueryBuilder<CoordinatorProfileEntity>,
    params: CoordinatorProfilesQueryDto,
  ) {
    const text = (params.searchString ?? params.q)?.trim();
    const { active, hasClubs } = params;
    const clubNumber = this.coerceClubNumber((params as any).clubNumber);

    if (text) {
      const like = `%${text.toLowerCase()}%`;
      const likeRaw = `%${text}%`;
      qb.andWhere(
        `(
          LOWER(coord_user.name)  LIKE :like OR
          LOWER(coord_user.email) LIKE :like OR
          coord_user.phone        LIKE :likeRaw
          OR EXISTS (
            SELECT 1
            FROM clubs c
            JOIN teacher_profiles tp ON tp.club_id = c.id
            JOIN users tu ON tu.id = tp.user_id
            WHERE c.coordinator_profile_id = coord.id
              AND (
                LOWER(tu.name)  LIKE :like OR
                LOWER(tu.email) LIKE :like OR
                tu.phone        LIKE :likeRaw
              )
          )
        )`,
        { like, likeRaw },
      );
    }

    if (typeof active === 'boolean') {
      qb.andWhere('coord.active = :active', { active });
    }

    if (clubNumber !== undefined) {
      qb.andWhere(
        `EXISTS (
          SELECT 1
          FROM clubs cnum
          WHERE cnum.coordinator_profile_id = coord.id
            AND cnum.number = :clubNumber
        )`,
        { clubNumber },
      );
    }

    if (hasClubs !== undefined) {
      if (hasClubs === true) {
        qb.andWhere(`
          EXISTS (
            SELECT 1
            FROM clubs c
            WHERE c.coordinator_profile_id = coord.id
            LIMIT 1
          )
        `);
      } else {
        qb.andWhere(`
          NOT EXISTS (
            SELECT 1
            FROM clubs c
            WHERE c.coordinator_profile_id = coord.id
            LIMIT 1
          )
        `);
      }
    }

    return qb;
  }

  async findPageWithFilters(query: CoordinatorProfilesQueryDto): Promise<{
    items: CoordinatorProfileEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 12,
      sort = 'updatedAt',
      order = 'desc',
    } = query;

    const sortColumn = this.resolveSort(sort);
    const sortDir: SortDir =
      (order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const total = await this.applyFilters(this.baseIdsQuery(), query)
      .select('coord.id')
      .distinct(true)
      .getCount();

    const pageIdsRaw = await this.applyFilters(this.baseIdsQuery(), query)
      .select('coord.id', 'id')
      .addSelect(sortColumn, 'ord')
      .distinct(true)
      .orderBy(sortColumn, sortDir)
      .offset(offset)
      .limit(limit)
      .getRawMany<{ id: string }>();

    const ids = pageIdsRaw.map((r) => r.id);
    if (!ids.length) {
      return { items: [], total, page, limit };
    }

    const items = await this.buildCoordinatorBaseQB()
      .andWhere('coord.id IN (:...ids)', { ids })
      .orderBy(sortColumn, sortDir)
      .addOrderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC')
      .getMany();

    return { items, total, page, limit };
  }

  async findAllWithClubsAndTeachers(): Promise<CoordinatorProfileEntity[]> {
    return this.buildCoordinatorBaseQB()
      .orderBy('coord.createdAt', 'ASC')
      .addOrderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC')
      .getMany();
  }

  async findOneWithClubsAndTeachersOrFail(
    id: string,
  ): Promise<CoordinatorProfileEntity> {
    const coord = await this.buildCoordinatorBaseQB()
      .andWhere('coord.id = :id', { id })
      .orderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC')
      .getOne();

    if (!coord) throw new NotFoundException('CoordinatorProfile não encontrado');
    return coord;
  }

  async findByClubIdWithTeachersOrFail(
    clubId: string,
  ): Promise<CoordinatorProfileEntity> {
    const club = await this.clubRepo.findOne({
      where: { id: clubId },
      relations: { coordinator: true },
    });
    if (!club) throw new NotFoundException('Club não encontrado');
    if (!club.coordinator) {
      throw new NotFoundException('Este Club não possui coordenador vinculado');
    }
    return this.findOneWithClubsAndTeachersOrFail(club.coordinator.id);
  }

  async assignClubToCoordinator(
    coordinatorId: string,
    clubId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const coordRepo = manager.withRepository(this.coordRepo);
      const clubRepo = manager.withRepository(this.clubRepo);

      const coordinator = await coordRepo.findOne({ where: { id: coordinatorId } });
      if (!coordinator)
        throw new NotFoundException('CoordinatorProfile não encontrado');

      const club = await clubRepo.findOne({
        where: { id: clubId },
        relations: { coordinator: true },
      });
      if (!club) throw new NotFoundException('Club não encontrado');

      if (club.coordinator && club.coordinator.id === coordinatorId) return;

      club.coordinator = coordinator;
      await clubRepo.save(club);
    });
  }

  async unassignClubFromCoordinator(
    coordinatorId: string,
    clubId: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const clubRepo = manager.withRepository(this.clubRepo);

      const club = await clubRepo.findOne({
        where: { id: clubId },
        relations: { coordinator: true },
      });
      if (!club) throw new NotFoundException('Club não encontrado');

      if (!club.coordinator || club.coordinator.id !== coordinatorId) {
        throw new BadRequestException(
          'Este Club não está vinculado a este coordenador',
        );
      }

      club.coordinator = null as any;
      await clubRepo.save(club);
    });
  }

  async moveClubBetweenCoordinators(
    fromCoordinatorId: string,
    clubId: string,
    toCoordinatorId: string,
  ): Promise<void> {
    if (fromCoordinatorId === toCoordinatorId) {
      throw new BadRequestException('Coordenadores de origem e destino são iguais');
    }

    await this.dataSource.transaction(async (manager) => {
      const coordRepo = manager.withRepository(this.coordRepo);
      const clubRepo = manager.withRepository(this.clubRepo);

      const [from, to] = await Promise.all([
        coordRepo.findOne({ where: { id: fromCoordinatorId } }),
        coordRepo.findOne({ where: { id: toCoordinatorId } }),
      ]);
      if (!from)
        throw new NotFoundException('CoordinatorProfile de origem não encontrado');
      if (!to)
        throw new NotFoundException('CoordinatorProfile de destino não encontrado');

      const club = await clubRepo.findOne({
        where: { id: clubId },
        relations: { coordinator: true },
      });
      if (!club) throw new NotFoundException('Club não encontrado');

      if (!club.coordinator || club.coordinator.id !== fromCoordinatorId) {
        throw new BadRequestException(
          'O Club não está vinculado ao coordenador de origem',
        );
      }

      club.coordinator = to;
      await clubRepo.save(club);
    });
  }

  async createForUser(userId: string): Promise<CoordinatorProfileEntity> {
    return this.dataSource.transaction(async (manager) => {
      const txCoord = manager.withRepository(this.coordRepo);
      const txUser = manager.withRepository(this.userRepo);

      const user = await txUser.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User não encontrado');

      const existing = await txCoord.findOne({ where: { user: { id: userId } } });
      if (existing) return existing;

      const entity = txCoord.create({ user: user as any, active: true });
      return txCoord.save(entity);
    });
  }

  async removeByUserId(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txCoord = manager.withRepository(this.coordRepo);
      const txClub = manager.withRepository(this.clubRepo);

      const coord = await txCoord.findOne({
        where: { user: { id: userId } },
        relations: { clubs: true },
      });
      if (!coord) return;

      if (coord.clubs?.length) {
        await txClub
          .createQueryBuilder()
          .update(ClubEntity)
          .set({ coordinator: null as any })
          .where('coordinator_profile_id = :id', { id: coord.id })
          .execute();
      }

      await txCoord.delete(coord.id);
    });
  }

  async list(): Promise<CoordinatorSimpleListDto[]> {
    const items = await this.coordRepo
      .createQueryBuilder('coord')
      .leftJoin('coord.user', 'user')
      .addSelect(['user.id', 'user.name'])
      .leftJoinAndSelect('coord.clubs', 'club')
      .where('user.active = true')
      .orderBy('coord.createdAt', 'ASC')
      .addOrderBy('club.number', 'ASC')
      .getMany();

    return items.map(toCoordinatorSimple);
  }
}
