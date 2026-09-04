import { Injectable } from '@nestjs/common';
import {
  AppNotFoundException,
  AppConflictException,
  ErrorCode,
} from 'src/shared/exceptions';
import {
  DataSource,
  EntityManager,
  In,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

import { CreateClubDto } from '../dto/create-club.dto';
import { UpdateClubDto } from '../dto/update-club.dto';
import { QueryClubsDto } from '../dto/query-clubs.dto';

import { ClubEntity } from '../entities/club.entity';
import { AddressEntity } from 'src/modules/addresses/entities/address.entity/address.entity';
import { CoordinatorProfileEntity } from 'src/modules/coordinator-profiles/entities/coordinator-profile.entity/coordinator-profile.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { ClubSelectOptionDto } from '../dto/club-select-option.dto';
import { toClubSelectOption } from '../mappers';
import { ClubAccessContext as RoleCtx } from '../types';
import {
  CLUBS_DEFAULT_LIMIT,
  CLUBS_DEFAULT_PAGE,
  CLUB_DEFAULT_ORDER,
  CLUB_DEFAULT_SORT,
  CLUB_SORT_COLUMNS,
} from '../constants';

@Injectable()
export class ClubsRepository {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(ClubEntity)
    private readonly clubRepo: Repository<ClubEntity>,

    @InjectRepository(AddressEntity)
    private readonly addressRepo: Repository<AddressEntity>,

    @InjectRepository(CoordinatorProfileEntity)
    private readonly coordRepo: Repository<CoordinatorProfileEntity>,

    @InjectRepository(TeacherProfileEntity)
    private readonly teacherProfileRepo: Repository<TeacherProfileEntity>,
  ) {}

  private buildClubBaseQB(
    manager?: EntityManager,
  ): SelectQueryBuilder<ClubEntity> {
    const repo = manager ? manager.getRepository(ClubEntity) : this.clubRepo;
    return repo
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.address', 'address')
      .leftJoinAndSelect('club.coordinator', 'coordinator')
      .leftJoinAndSelect('club.teachers', 'teachers')
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
      .leftJoin('teachers.user', 'teacher_user')
      .addSelect([
        'teacher_user.id',
        'teacher_user.name',
        'teacher_user.email',
        'teacher_user.phone',
        'teacher_user.active',
        'teacher_user.completed',
        'teacher_user.commonUser',
      ]);
  }

  private applyRoleFilter(qb: SelectQueryBuilder<ClubEntity>, ctx?: RoleCtx) {
    const role = ctx?.role?.toLowerCase();
    const userId = ctx?.userId;
    if (!role || role === 'admin' || !userId) return;

    if (role === 'coordinator') {
      qb.andWhere('coord_user.id = :uid', { uid: userId }).distinct(true);
    } else if (role === 'teacher') {
      qb.andWhere('teacher_user.id = :uid', { uid: userId }).distinct(true);
    } else {
      qb.andWhere('1 = 0');
    }
  }

  async findByIdWithRelationsOrFail(id: string): Promise<ClubEntity> {
    const club = await this.clubRepo.findOne({
      where: { id },
      relations: {
        address: true,
        coordinator: { user: true, clubs: false },
        teachers: { user: true, club: false },
      },
      order: { number: 'ASC' },
    });
    if (!club)
      throw new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      );
    return club;
  }

  async findOneOrFailForResponse(
    id: string,
    ctx?: RoleCtx,
  ): Promise<ClubEntity | null> {
    const qb = this.buildClubBaseQB()
      .where('club.id = :id', { id })
      .orderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC');
    this.applyRoleFilter(qb, ctx);

    return qb.getOne();
  }

  async findAllPaginated(
    q: QueryClubsDto,
    ctx?: RoleCtx,
  ): Promise<{ items: ClubEntity[]; total: number }> {
    const {
      page = CLUBS_DEFAULT_PAGE,
      limit = CLUBS_DEFAULT_LIMIT,
      searchString,
      sort = CLUB_DEFAULT_SORT,
      order = CLUB_DEFAULT_ORDER,
    } = q;

    const qb = this.buildClubBaseQB().distinct(true);
    this.applyRoleFilter(qb, ctx);

    if (searchString?.trim()) {
      const raw = searchString.trim();
      const like = `%${raw}%`;
      const n = Number(raw);
      const isNum = Number.isInteger(n) && n > 0;

      if (isNum) {
        qb.andWhere(
          `(
            club.number = :clubNum OR
            LOWER(address.district) LIKE LOWER(:like) OR
            LOWER(address.city)     LIKE LOWER(:like)
          )`,
          { clubNum: n, like },
        );
      } else {
        qb.andWhere(
          `(
            LOWER(address.district) LIKE LOWER(:like) OR
            LOWER(address.city)     LIKE LOWER(:like)
          )`,
          { like },
        );
      }
    }

    if (q.isActive !== undefined) {
      qb.andWhere('club.isActive = :isActive', { isActive: q.isActive });
    }

    // O DTO já validou o campo e a direção; aqui só traduzimos para a coluna.
    qb.orderBy(CLUB_SORT_COLUMNS[sort], order);

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /**
   * Lista leve, sem vínculos.
   *
   * O endereço vem inteiro porque é isso que `ClubSimpleResponseDto` promete;
   * selecionar só parte dele devolveria campos vazios no contrato.
   */
  async findAllSimple(ctx?: RoleCtx): Promise<ClubEntity[]> {
    const qb = this.buildClubBaseQB()
      .select([
        'club.id',
        'club.number',
        'club.weekday',
        'club.time',
        'club.isActive',
        'club.createdAt',
        'club.updatedAt',
        'address.id',
        'address.street',
        'address.number',
        'address.district',
        'address.city',
        'address.state',
        'address.postalCode',
        'address.complement',
        'address.createdAt',
        'address.updatedAt',
      ])
      .orderBy('club.number', 'ASC');

    this.applyRoleFilter(qb, ctx);

    return qb.getMany();
  }

  /**
   * Opções dos seletores.
   *
   * Só o que o rótulo usa: número, bairro e a existência de coordenador.
   */
  async list(ctx?: RoleCtx): Promise<ClubSelectOptionDto[]> {
    const qb = this.buildClubBaseQB()
      .select([
        'club.id',
        'club.number',
        'address.id',
        'address.district',
        'coordinator.id',
      ])
      .orderBy('club.number', 'ASC');

    this.applyRoleFilter(qb, ctx);

    const items = await qb.getMany();
    return items.map(toClubSelectOption);
  }

  /**
   * Onde cada professor está hoje.
   *
   * Vincular um professor a um clubinho o move do anterior, então o caso de uso
   * precisa saber de onde ele viria para conferir o alcance de quem pediu.
   */
  async findCurrentClubIdsOfTeachers(
    teacherProfileIds: string[],
  ): Promise<Map<string, string | null>> {
    if (!teacherProfileIds.length) return new Map();

    const profiles = await this.teacherProfileRepo.find({
      where: { id: In(teacherProfileIds) },
      relations: { club: true },
      select: { id: true },
    });

    return new Map(
      profiles.map((profile) => [profile.id, profile.club?.id ?? null]),
    );
  }

  async createClub(dto: CreateClubDto): Promise<ClubEntity> {
    return this.dataSource.transaction(async (manager) => {
      const clubRepo = manager.withRepository(this.clubRepo);
      const addressRepo = manager.withRepository(this.addressRepo);
      const coordRepo = manager.withRepository(this.coordRepo);
      const teacherRepo = manager.withRepository(this.teacherProfileRepo);
      let address: AddressEntity | undefined;
      if (dto.address) {
        address = addressRepo.create(dto.address);
        await addressRepo.save(address);
      }

      let coordinator: CoordinatorProfileEntity | null = null;
      if (dto.coordinatorProfileId) {
        coordinator = await coordRepo.findOne({
          where: { id: dto.coordinatorProfileId },
        });
        if (!coordinator) {
          throw new AppNotFoundException(
            ErrorCode.COORDINATOR_NOT_FOUND,
            'Perfil de coordenador não encontrado',
          );
        }
      }

      const club = clubRepo.create({
        number: dto.number,
        weekday: dto.weekday,
        time: dto.time ?? null,
        isActive: dto.isActive !== undefined ? dto.isActive : true,
        address: address,
        coordinator: coordinator ?? null,
      });

      await this.saveClubOrFailOnDuplicateNumber(clubRepo, club);

      if (dto.teacherProfileIds?.length) {
        const ids = Array.from(new Set(dto.teacherProfileIds));
        const teachers = await teacherRepo.find({
          where: { id: In(ids) },
          relations: { club: true },
        });

        if (teachers.length !== ids.length) {
          const found = new Set(teachers.map((t) => t.id));
          const missing = ids.filter((id) => !found.has(id));
          throw new AppNotFoundException(
            ErrorCode.TEACHER_NOT_FOUND,
            `Perfil(s) de professor(es) não encontrado(s): ${missing.join(', ')}`,
          );
        }

        // Um professor vinculado a outro clubinho é movido, como acontece em
        // `PATCH /teacher-profiles/:id/assign-club`. A recusa anterior fazia a
        // mesma escolha responder coisas diferentes conforme a tela usada.
        await teacherRepo.update(
          { id: In(ids) },
          { club: { id: club.id } as Partial<ClubEntity> },
        );
      }
      return this.findOneOrFailForResponseTx(manager, club.id);
    });
  }

  async updateClub(id: string, dto: UpdateClubDto): Promise<ClubEntity> {
    return this.dataSource.transaction(async (manager) => {
      const clubRepo = manager.withRepository(this.clubRepo);
      const addressRepo = manager.withRepository(this.addressRepo);
      const coordRepo = manager.withRepository(this.coordRepo);
      const teacherRepo = manager.withRepository(this.teacherProfileRepo);

      const club = await clubRepo.findOne({
        where: { id },
        relations: { address: true, coordinator: true, teachers: true },
      });
      if (!club)
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );

      if (dto.number !== undefined) club.number = dto.number;
      if (dto.weekday !== undefined) club.weekday = dto.weekday;

      if (dto.time !== undefined) {
        club.time = dto.time;
      }

      if (dto.isActive !== undefined) {
        club.isActive = dto.isActive;
      }

      if (dto.address) {
        if (club.address) {
          Object.assign(club.address, dto.address);
          await addressRepo.save(club.address);
        } else {
          const newAddress = addressRepo.create(dto.address);
          await addressRepo.save(newAddress);
          club.address = newAddress;
        }
      }

      if (dto.coordinatorProfileId !== undefined) {
        if (dto.coordinatorProfileId === null) {
          club.coordinator = null;
        } else {
          const coordinator = await coordRepo.findOne({
            where: { id: dto.coordinatorProfileId },
          });
          if (!coordinator) {
            throw new AppNotFoundException(
              ErrorCode.COORDINATOR_NOT_FOUND,
              'Perfil de coordenador não encontrado',
            );
          }
          club.coordinator = coordinator;
        }
      }

      // A edição também pode esbarrar no número já usado; sem isto, trocar o
      // número por um existente devolvia erro interno em vez de conflito.
      await this.saveClubOrFailOnDuplicateNumber(clubRepo, club);

      if (dto.teacherProfileIds !== undefined) {
        await this.syncTeachersForClubTx(
          teacherRepo,
          club.id,
          dto.teacherProfileIds,
        );
      }

      return this.findOneOrFailForResponseTx(manager, club.id);
    });
  }

  /**
   * Grava o clubinho traduzindo a violação de unicidade do número em conflito.
   * O banco garante a regra; aqui ela vira uma resposta que o cliente entende.
   */
  private async saveClubOrFailOnDuplicateNumber(
    repo: Repository<ClubEntity>,
    club: ClubEntity,
  ): Promise<void> {
    try {
      await repo.save(club);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY' || code === '23505') {
        throw new AppConflictException(
          ErrorCode.CLUB_NUMBER_IN_USE,
          'Já existe um Clubinho com esse número',
        );
      }
      throw error;
    }
  }

  private async findOneOrFailForResponseTx(
    manager: EntityManager,
    id: string,
  ): Promise<ClubEntity> {
    const qb = this.buildClubBaseQB(manager)
      .where('club.id = :id', { id })
      .orderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC');

    const club = await qb.getOne();
    if (!club)
      throw new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      );
    return club;
  }

  private async syncTeachersForClubTx(
    txTeacherRepo: Repository<TeacherProfileEntity>,
    clubId: string,
    teacherProfileIds: string[],
  ): Promise<void> {
    const current = await txTeacherRepo.find({
      where: { club: { id: clubId } },
      select: { id: true },
    });
    const currentIds = new Set(current.map((t) => t.id));
    const targetIds = new Set(teacherProfileIds);

    const toAttach = [...targetIds].filter((id) => !currentIds.has(id));
    const toDetach = [...currentIds].filter((id) => !targetIds.has(id));

    const attachProfiles = toAttach.length
      ? await txTeacherRepo.find({
          where: { id: In(toAttach) },
          relations: { club: true },
        })
      : [];

    if (attachProfiles.length !== toAttach.length) {
      const found = new Set(attachProfiles.map((p) => p.id));
      const missing = toAttach.filter((id) => !found.has(id));
      throw new AppNotFoundException(
        ErrorCode.TEACHER_NOT_FOUND,
        `Perfil(s) de professor(es) não encontrado(s): ${missing.join(', ')}`,
      );
    }

    // Um professor vinculado a outro clubinho é movido, como acontece em
    // `PATCH /teacher-profiles/:id/assign-club`. Quem confere o alcance de quem
    // pediu é o caso de uso, antes de chegar aqui.
    if (attachProfiles.length) {
      await txTeacherRepo.update(
        { id: In(attachProfiles.map((p) => p.id)) },
        { club: { id: clubId } as Partial<ClubEntity> },
      );
    }

    if (toDetach.length) {
      await txTeacherRepo.update({ id: In(toDetach) }, { club: null });
    }
  }

  async deleteById(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const txClub = manager.withRepository(this.clubRepo);
      const txTeacher = manager.withRepository(this.teacherProfileRepo);
      const txAddress = manager.withRepository(this.addressRepo);

      const club = await txClub.findOne({
        where: { id },
        relations: { teachers: true, coordinator: true, address: true },
      });
      if (!club)
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );

      if (club.teachers?.length) {
        await txTeacher.update(
          { id: In(club.teachers.map((t) => t.id)) },
          { club: null },
        );
      }

      if (club.coordinator) {
        await txClub.update(
          { id: club.id },
          { coordinator: null as unknown as CoordinatorProfileEntity },
        );
      }

      const addressId = club.address?.id;

      await txClub.delete(club.id);

      if (addressId) {
        await txAddress.delete(addressId);
      }
    });
  }

  async userHasAccessToClub(clubId: string, ctx?: RoleCtx): Promise<boolean> {
    const role = ctx?.role?.toLowerCase();
    const userId = ctx?.userId;
    if (!role || role === 'admin') return true;
    if (!userId) return false;

    if (role !== 'coordinator') return false;

    const qb = this.clubRepo
      .createQueryBuilder('club')
      .leftJoin('club.coordinator', 'coord')
      .leftJoin('coord.user', 'coord_user')
      .where('club.id = :clubId', { clubId })
      .andWhere('coord_user.id = :uid', { uid: userId });

    const qbWithExists = qb as SelectQueryBuilder<ClubEntity> & {
      getExists?: () => Promise<boolean>;
    };
    const hasGetExists = typeof qbWithExists.getExists === 'function';
    return hasGetExists
      ? !!(await qbWithExists.getExists())
      : (await qb.getCount()) > 0;
  }

  async getCoordinatorProfileIdByUserId(
    userId: string,
  ): Promise<string | null> {
    const coord = await this.coordRepo.findOne({
      where: { user: { id: userId } },
      select: { id: true },
    });
    return coord?.id ?? null;
  }
}
