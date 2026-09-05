import { Injectable, Logger } from '@nestjs/common';
import {
  AppNotFoundException,
  AppBusinessException,
  ErrorCode,
} from 'src/shared/exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import { TeacherProfileEntity } from '../entities/teacher-profile.entity/teacher-profile.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import {
  TeacherSimpleListDto,
  toTeacherSimple,
} from '../dto/teacher-simple-list.dto';
import { AccessContext, UserRole } from 'src/core/auth/auth.types';
import {
  SortOrder,
  TEACHERS_DEFAULT_LIMIT,
  TEACHERS_DEFAULT_ORDER,
  TEACHERS_DEFAULT_PAGE,
  TEACHERS_DEFAULT_SORT,
  TEACHERS_MAX_LIMIT,
  TEACHER_SORT_COLUMNS,
  TeacherSortField,
} from '../constants';
import { TeacherProfilesQueryDto } from '../dto/teacher-profiles.query.dto';
import { normalizeRole } from 'src/core/auth/role.utils';

/** Uma página de professores, como o banco a devolve. */
export interface PaginatedTeachers {
  items: TeacherProfileEntity[];
  total: number;
  page: number;
  limit: number;
}
type SortDir = 'ASC' | 'DESC';

@Injectable()
export class TeacherProfilesRepository {
  private readonly logger = new Logger(TeacherProfilesRepository.name);

  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(TeacherProfileEntity)
    private readonly teacherRepo: Repository<TeacherProfileEntity>,

    @InjectRepository(ClubEntity)
    private readonly clubRepo: Repository<ClubEntity>,

    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  /**
   * A situação da conta não peneira a listagem: um professor suspenso continua
   * sendo gerenciado — e continua no clubinho. Quem filtra é o parâmetro
   * `active`, que lê o perfil.
   */
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
      ]);
  }

  private baseIdsQuery(): SelectQueryBuilder<TeacherProfileEntity> {
    return this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoin('teacher.user', 'teacher_user')
      .leftJoin('teacher.club', 'club')
      .leftJoin('club.coordinator', 'coordinator')
      .leftJoin('coordinator.user', 'coord_user');
  }

  /**
   * Coluna do banco para o campo de ordenação pedido.
   *
   * Só um nome da tabela de constantes chega ao SQL; o valor recebido nunca é
   * interpolado.
   */
  private resolveSort(sort?: TeacherSortField): string {
    return (
      TEACHER_SORT_COLUMNS[sort ?? TEACHERS_DEFAULT_SORT] ??
      TEACHER_SORT_COLUMNS[TEACHERS_DEFAULT_SORT]
    );
  }

  private applyRoleFilter(
    qb: SelectQueryBuilder<TeacherProfileEntity>,
    ctx?: AccessContext,
  ) {
    const role = ctx?.role;
    const userId = ctx?.userId;
    if (!role || role === UserRole.ADMIN || !userId) return;

    if (role === UserRole.COORDINATOR) {
      qb.andWhere('coord_user.id = :uid', { uid: userId }).distinct(true);
    } else if (role === UserRole.TEACHER) {
      qb.andWhere('1 = 0');
    }
  }

  private applyFilters(
    qb: SelectQueryBuilder<TeacherProfileEntity>,
    params: TeacherProfilesQueryDto,
  ) {
    const text = (params.searchString ?? params.q)?.trim();
    const { active, hasClub, clubNumber } = params;

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

  async findOneWithClubAndCoordinatorOrFail(
    id: string,
    ctx?: AccessContext,
  ): Promise<TeacherProfileEntity> {
    const qb = this.baseQB().andWhere('teacher.id = :id', { id });
    this.applyRoleFilter(qb, ctx);

    const teacher = await qb.getOne();
    if (!teacher)
      throw new AppNotFoundException(
        ErrorCode.TEACHER_NOT_FOUND,
        'Perfil de professor não encontrado',
      );
    return teacher;
  }

  async findByClubIdWithCoordinator(
    clubId: string,
    ctx?: AccessContext,
  ): Promise<TeacherProfileEntity[]> {
    const club = await this.clubRepo.findOne({ where: { id: clubId } });
    if (!club)
      throw new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      );

    if (ctx?.role && ctx.role !== UserRole.ADMIN) {
      const allowed = await this.userHasAccessToClub(clubId, ctx);
      if (!allowed)
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );
    }

    const qb = this.baseQB().andWhere('club.id = :clubId', { clubId });
    this.applyRoleFilter(qb, ctx);

    return qb.orderBy('teacher.createdAt', 'ASC').getMany();
  }

  async findPageWithFilters(
    query: TeacherProfilesQueryDto,
    ctx?: AccessContext,
  ): Promise<PaginatedTeachers> {
    const {
      page = TEACHERS_DEFAULT_PAGE,
      sort = TEACHERS_DEFAULT_SORT,
      order = TEACHERS_DEFAULT_ORDER,
    } = query;
    const limit = Math.min(
      Math.max(query.limit ?? TEACHERS_DEFAULT_LIMIT, 1),
      TEACHERS_MAX_LIMIT,
    );

    const sortColumn = this.resolveSort(sort);
    const sortDir: SortDir = order === SortOrder.ASC ? 'ASC' : 'DESC';
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
      // O desempate por id mantém a paginação estável quando duas linhas têm o
      // mesmo valor na coluna ordenada.
      .addOrderBy('teacher.id', 'ASC')
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

  async list(ctx?: AccessContext): Promise<TeacherSimpleListDto[]> {
    const qb = this.teacherRepo
      .createQueryBuilder('teacher')
      .leftJoin('teacher.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.email', 'user.active'])
      .leftJoinAndSelect('teacher.club', 'club')
      .where('user.active = true')
      .orderBy('teacher.createdAt', 'ASC');

    if (ctx?.role === UserRole.TEACHER) {
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
        txTeacherRepo.findOne({
          where: { id: teacherId },
          relations: { club: true },
        }),
        txClubRepo.findOne({ where: { id: clubId } }),
      ]);

      if (!teacher)
        throw new AppNotFoundException(
          ErrorCode.TEACHER_NOT_FOUND,
          'Perfil de professor não encontrado',
        );
      if (!club)
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );

      if (teacher.club?.id === clubId) return;

      // Trocar de clubinho é uma operação só: desvincular antes deixaria o
      // professor sem turma se a segunda chamada falhasse, e a tela oferece
      // exatamente esta troca. Ninguém mais perde nada — o clubinho é um
      // atributo do professor, e não um recurso disputado.
      const previousClubId = teacher.club?.id ?? null;

      teacher.club = club;
      await txTeacherRepo.save(teacher);

      if (previousClubId) {
        this.logger.log(
          `Professor ${teacherId} movido do clubinho ${previousClubId} para ${clubId}`,
        );
      }
    });
  }

  async unassignTeacherFromClub(
    teacherId: string,
    expectedClubId?: string,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txTeacherRepo = manager.withRepository(this.teacherRepo);

      const teacher = await txTeacherRepo.findOne({
        where: { id: teacherId },
        relations: { club: true },
      });
      if (!teacher)
        throw new AppNotFoundException(
          ErrorCode.TEACHER_NOT_FOUND,
          'Perfil de professor não encontrado',
        );

      if (!teacher.club) return;

      if (expectedClubId && teacher.club.id !== expectedClubId) {
        throw new AppBusinessException(
          ErrorCode.PROFILE_INVALID_OPERATION,
          'Professor não pertence ao clubinho informado',
        );
      }

      teacher.club = null;
      await txTeacherRepo.save(teacher);
    });
  }

  async createForUser(userId: string): Promise<TeacherProfileEntity> {
    return this.dataSource.transaction(async (manager) => {
      const txTeacher = manager.withRepository(this.teacherRepo);
      const txUser = manager.withRepository(this.userRepo);

      const user = await txUser.findOne({ where: { id: userId } });
      if (!user)
        throw new AppNotFoundException(
          ErrorCode.USER_NOT_FOUND,
          'Usuário não encontrado',
        );

      const existing = await txTeacher.findOne({
        where: { user: { id: userId } },
      });
      if (existing) return existing;

      const entity = txTeacher.create({
        user: user,
        active: true,
        club: null,
      });
      return txTeacher.save(entity);
    });
  }

  async removeByUserId(userId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txTeacher = manager.withRepository(this.teacherRepo);
      const profile = await txTeacher.findOne({
        where: { user: { id: userId } },
      });
      if (!profile) return;
      await txTeacher.delete(profile.id);
    });
  }

  /**
   * Liga ou desliga o perfil sem mexer no clubinho.
   *
   * Desativar um professor apagava o perfil, e com ele o vínculo: reativar
   * criava um perfil novo, sem turma, e ninguém era avisado de que a ligação
   * havia sumido. A criação já mantinha o perfil de um usuário inativo, então
   * as duas rotinas discordavam.
   */
  async setActiveByUserId(userId: string, active: boolean): Promise<void> {
    const profile = await this.teacherRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!profile || profile.active === active) return;

    await this.teacherRepo.update(profile.id, { active });
  }

  async linkTeacherToClubByNumber(
    userId: string,
    clubNumber: number,
  ): Promise<TeacherProfileEntity> {
    this.logger.log(
      `🔗 Vinculando teacher userId=${userId} ao clubinho número=${clubNumber}`,
    );

    return this.dataSource.transaction(async (manager) => {
      const txTeacher = manager.withRepository(this.teacherRepo);
      const txClub = manager.withRepository(this.clubRepo);
      const txUser = manager.withRepository(this.userRepo);

      const club = await txClub.findOne({
        where: { number: clubNumber, isActive: true },
      });
      if (!club) {
        throw new AppBusinessException(
          ErrorCode.CLUB_NOT_FOUND,
          `Nenhum clubinho ativo encontrado com o número ${clubNumber}.`,
        );
      }

      let profile = await txTeacher.findOne({
        where: { user: { id: userId } },
        relations: { club: true },
      });

      if (!profile) {
        const user = await txUser.findOne({ where: { id: userId } });
        if (!user) {
          throw new AppNotFoundException(
            ErrorCode.USER_NOT_FOUND,
            'Usuário não encontrado.',
          );
        }
        profile = txTeacher.create({
          user,
          active: true,
          club,
        });
      } else {
        if (profile.club) {
          throw new AppBusinessException(
            ErrorCode.PROFILE_INVALID_OPERATION,
            'Você já está vinculado a um clubinho e não pode alterar essa informação.',
          );
        }
        profile.club = club;
        profile.active = true;
      }

      const saved = await txTeacher.save(profile);
      this.logger.log(
        `✅ Teacher userId=${userId} vinculado ao clubinho #${club.number} (profileId=${saved.id})`,
      );
      return saved;
    });
  }

  async userHasAccessToClub(
    clubId: string,
    ctx?: AccessContext,
  ): Promise<boolean> {
    const role = normalizeRole(ctx?.role);
    const userId = ctx?.userId;
    // Sem papel reconhecido a checagem é dispensada: quem chega aqui já passou
    // pelo guard, e o papel desconhecido não é escopo a restringir.
    if (!role || role === UserRole.ADMIN) return true;
    if (!userId) return false;

    const qb = this.clubRepo
      .createQueryBuilder('club')
      .where('club.id = :clubId', { clubId });

    if (role === UserRole.COORDINATOR) {
      qb.leftJoin('club.coordinator', 'coord')
        .leftJoin('coord.user', 'coord_user')
        .andWhere('coord_user.id = :uid', { uid: userId });
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
}
