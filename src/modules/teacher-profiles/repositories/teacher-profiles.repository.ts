import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { UserEntity } from 'src/user/user.entity';
import { TeacherSimpleListDto, toTeacherSimple } from '../dto/teacher-simple-list.dto';
import { TeacherProfilesQueryDto } from '../dto/teacher-profiles.query.dto';

type RoleCtx = { role?: string; userId?: string | null };
type SortDir = 'ASC' | 'DESC';

@Injectable()
export class TeacherProfilesRepository {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(TeacherProfileEntity)
    private readonly teacherRepo: Repository<TeacherProfileEntity>,

    @InjectRepository(ClubEntity)
    private readonly clubRepo: Repository<ClubEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) { }

  private baseQB(): SelectQueryBuilder<TeacherProfileEntity> {
    return this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoinAndSelect('teacher.club', 'club')
      .leftJoinAndSelect('club.coordinator', 'coordinator')
      .leftJoin('teacher.user', 'teacher_user')
      .addSelect([
        'teacher_user.id',
        'teacher_user.name',
        'teacher_user.email',
        'teacher_user.phone',
        'teacher_user.active',
        'teacher_user.completed',
        'teacher_user.commonUser',
      ])
      .leftJoin('coordinator.user', 'coord_user')
      .addSelect([
        'coord_user.id',
        'coord_user.name',
        'coord_user.email',
        'coord_user.phone',
        'coord_user.active',
        'coord_user.completed',
        'coord_user.commonUser',
      ])
      .andWhere('teacher_user.active = true');
  }

  private baseIdsQuery(): SelectQueryBuilder<TeacherProfileEntity> {
    return this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoin('teacher.user', 'teacher_user')
      .leftJoin('teacher.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('coordinator.user', 'coord_user')
      .where('teacher_user.active = true');
  }

  private resolveSort(sort?: string) {
    const map: Record<string, string> = {
      createdAt: 'teacher.createdAt',
      updatedAt: 'teacher.updatedAt',
      name: 'teacher_user.name',
      clubNumber: 'club.number',
    };
    return map[sort ?? 'updatedAt'] ?? 'teacher.updatedAt';
  }

  private applyRoleFilter(qb: SelectQueryBuilder<TeacherProfileEntity>, ctx?: RoleCtx) {
    const role = ctx?.role?.toLowerCase();
    const userId = ctx?.userId;
    if (!role || role === 'admin' || !userId) return;

    if (role === 'coordinator') {
      qb.andWhere('coord_user.id = :uid', { uid: userId }).distinct(true);
    } else if (role === 'teacher') {
      qb.andWhere('1 = 0');
    }
  }

  private coerceInt(input: unknown): number | undefined {
    if (input === undefined || input === null || input === '') return undefined;
    const n = Number(String(input).trim());
    return Number.isInteger(n) ? n : undefined;
  }

  private applyFilters(
    qb: SelectQueryBuilder<TeacherProfileEntity>,
    params: TeacherProfilesQueryDto,
  ) {
    const text = (params.searchString ?? params.q)?.trim();
    const { active, hasClub } = params;
    const clubNumber = this.coerceInt((params as any).clubNumber);

    if (text) {
      const like = `%${text.toLowerCase()}%`;
      const likeRaw = `%${text}%`;
      qb.andWhere(
        `(
          LOWER(teacher_user.name)  LIKE :like OR
          LOWER(teacher_user.email) LIKE :like OR
          teacher_user.phone        LIKE :likeRaw OR
          LOWER(coord_user.name)    LIKE :like OR
          LOWER(coord_user.email)   LIKE :like OR
          coord_user.phone          LIKE :likeRaw
        )`,
        { like, likeRaw },
      );
    }

    if (typeof active === 'boolean') {
      qb.andWhere('teacher.active = :active', { active });
    }

    if (clubNumber !== undefined) {
      qb.andWhere('club.number = :clubNumber', { clubNumber });
    }

    if (hasClub !== undefined) {
      if (hasClub === true) {
        qb.andWhere('teacher.club IS NOT NULL');
      } else {
        qb.andWhere('teacher.club IS NULL');
      }
    }

    return qb;
  }

  async findAllWithClubAndCoordinator(ctx?: RoleCtx): Promise<TeacherProfileEntity[]> {
    const qb = this.baseQB()
      .orderBy('teacher.createdAt', 'ASC')
      .addOrderBy('club.number', 'ASC');

    this.applyRoleFilter(qb, ctx);
    return qb.getMany();
  }

  async findOneWithClubAndCoordinatorOrFail(id: string, ctx?: RoleCtx): Promise<TeacherProfileEntity> {
    const qb = this.baseQB().andWhere('teacher.id = :id', { id });
    this.applyRoleFilter(qb, ctx);

    const teacher = await qb.getOne();
    if (!teacher) throw new NotFoundException('TeacherProfile não encontrado');
    return teacher;
  }

  async findByClubIdWithCoordinator(clubId: string, ctx?: RoleCtx): Promise<TeacherProfileEntity[]> {
    const club = await this.clubRepo.findOne({ where: { id: clubId } });
    if (!club) throw new NotFoundException('Club não encontrado');

    if (ctx?.role && ctx.role !== 'admin') {
      const allowed = await this.userHasAccessToClub(clubId, ctx);
      if (!allowed) throw new NotFoundException('Club não encontrado');
    }

    const qb = this.baseQB().andWhere('club.id = :clubId', { clubId });
    this.applyRoleFilter(qb, ctx);

    return qb.orderBy('teacher.createdAt', 'ASC').getMany();
  }

  async findPageWithFilters(
    query: TeacherProfilesQueryDto,
    ctx?: RoleCtx,
  ): Promise<{
    items: TeacherProfileEntity[];
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
    const sortDir: SortDir = (order || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const offset = (page - 1) * limit;

    const totalQB = this.applyFilters(this.baseIdsQuery(), query)
      .select('teacher.id')
      .distinct(true);
    this.applyRoleFilter(totalQB, ctx);
    const total = await totalQB.getCount();

    const idsQB = this.applyFilters(this.baseIdsQuery(), query)
      .select('teacher.id', 'id')
      .addSelect(sortColumn, 'ord')
      .distinct(true)
      .orderBy(sortColumn, sortDir)
      .offset(offset)
      .limit(limit);
    this.applyRoleFilter(idsQB, ctx);
    const pageIds = await idsQB.getRawMany<{ id: string }>();
    const ids = pageIds.map((r) => r.id);

    if (!ids.length) {
      return { items: [], total, page, limit };
    }

    const itemsQB = this.baseQB()
      .andWhere('teacher.id IN (:...ids)', { ids })
      .orderBy(sortColumn, sortDir)
      .addOrderBy('club.number', 'ASC')
      .addOrderBy('teacher.createdAt', 'ASC');
    this.applyRoleFilter(itemsQB, ctx);
    const items = await itemsQB.getMany();

    return { items, total, page, limit };
  }

  async list(ctx?: RoleCtx): Promise<TeacherSimpleListDto[]> {
    const qb = this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoin('teacher.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.email', 'user.active'])
      .leftJoinAndSelect('teacher.club', 'club')
      .where('user.active = true')
      .orderBy('teacher.createdAt', 'ASC');

    if (ctx?.role === 'teacher') {
      qb.andWhere('1 = 0');
    }

    const items = await qb.getMany();
    return items.map(toTeacherSimple);
  }


  async assignTeacherToClub(teacherId: string, clubId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txTeacherRepo = manager.withRepository(this.teacherRepo);
      const txClubRepo = manager.withRepository(this.clubRepo);

      const [teacher, club] = await Promise.all([
        txTeacherRepo.findOne({ where: { id: teacherId }, relations: { club: true } }),
        txClubRepo.findOne({ where: { id: clubId } }),
      ]);

      if (!teacher) throw new NotFoundException('TeacherProfile não encontrado');
      if (!club) throw new NotFoundException('Club não encontrado');

      if (teacher.club && teacher.club.id === clubId) return;

      if (teacher.club && teacher.club.id !== clubId) {
        throw new BadRequestException('Teacher já está vinculado a outro Club');
      }

      teacher.club = club;
      await txTeacherRepo.save(teacher);
    });
  }

  async unassignTeacherFromClub(teacherId: string, expectedClubId?: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txTeacherRepo = manager.withRepository(this.teacherRepo);

      const teacher = await txTeacherRepo.findOne({
        where: { id: teacherId },
        relations: { club: true },
      });
      if (!teacher) throw new NotFoundException('TeacherProfile não encontrado');

      if (!teacher.club) return;

      if (expectedClubId && teacher.club.id !== expectedClubId) {
        throw new BadRequestException('Teacher não pertence ao club informado');
      }

      teacher.club = null as any;
      await txTeacherRepo.save(teacher);
    });
  }

  async createForUser(userId: string): Promise<TeacherProfileEntity> {
    return this.dataSource.transaction(async (manager) => {
      const txTeacher = manager.withRepository(this.teacherRepo);
      const txUser = manager.withRepository(this.userRepo);

      const user = await txUser.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User não encontrado');

      const existing = await txTeacher.findOne({ where: { user: { id: userId } } });
      if (existing) return existing;

      const entity = txTeacher.create({ user: user as any, active: true, club: null as any });
      return txTeacher.save(entity);
    });
  }

  async removeByUserId(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txTeacher = manager.withRepository(this.teacherRepo);
      const profile = await txTeacher.findOne({ where: { user: { id: userId } } });
      if (!profile) return;
      await txTeacher.delete(profile.id);
    });
  }

  async userHasAccessToClub(clubId: string, ctx?: RoleCtx): Promise<boolean> {
    const role = ctx?.role?.toLowerCase();
    const userId = ctx?.userId;
    if (!role || role === 'admin') return true;
    if (!userId) return false;

    const qb = this.clubRepo.createQueryBuilder('club').where('club.id = :clubId', { clubId });

    if (role === 'coordinator') {
      qb.leftJoin('club.coordinator', 'coord')
        .leftJoin('coord.user', 'coord_user')
        .andWhere('coord_user.id = :uid', { uid: userId });
    } else {
      return false;
    }

    const hasGetExists = typeof (qb as any).getExists === 'function';
    return hasGetExists ? !!(await (qb as any).getExists()) : (await qb.getCount()) > 0;
  }
}
