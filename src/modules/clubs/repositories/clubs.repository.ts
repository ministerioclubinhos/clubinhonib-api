import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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

import { ClubEntity } from '../entities/club.entity/club.entity';
import { AddressEntity } from 'src/modules/addresses/entities/address.entity/address.entity';
import { CoordinatorProfileEntity } from 'src/modules/coordinator-profiles/entities/coordinator-profile.entity/coordinator-profile.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { ClubSelectOptionDto, toClubSelectOption } from '../dto/club-select-option.dto';

type RoleCtx = { role?: string; userId?: string | null };

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
  ) { }

  private buildClubBaseQB(manager?: EntityManager): SelectQueryBuilder<ClubEntity> {
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
    if (!club) throw new NotFoundException('Club não encontrado');
    return club;
  }

  async findOneOrFailForResponse(id: string, ctx?: RoleCtx): Promise<ClubEntity | null> {
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
      page = 1,
      limit = 10,
      addressSearchString,
      userSearchString,
      clubSearchString,
      sort = 'number',
      order = 'ASC',
    } = q;

    const qb = this.buildClubBaseQB().distinct(true);
    this.applyRoleFilter(qb, ctx);

    if (addressSearchString?.trim()) {
      const like = `%${addressSearchString.trim()}%`;
      qb.andWhere(
        `(
          LOWER(address.street)      LIKE LOWER(:like) OR
          LOWER(address.district)    LIKE LOWER(:like) OR
          LOWER(address.city)        LIKE LOWER(:like) OR
          LOWER(address.state)       LIKE LOWER(:like) OR
          LOWER(address.postalCode)  LIKE LOWER(:like)
        )`,
        { like },
      );
    }

    if (userSearchString?.trim()) {
      const like = `%${userSearchString.trim()}%`;
      qb.andWhere(
        `(
          LOWER(coord_user.name)   LIKE LOWER(:like) OR
          LOWER(coord_user.email)  LIKE LOWER(:like) OR
          LOWER(coord_user.phone)  LIKE LOWER(:like) OR
          LOWER(teacher_user.name) LIKE LOWER(:like) OR
          LOWER(teacher_user.email)LIKE LOWER(:like) OR
          LOWER(teacher_user.phone)LIKE LOWER(:like)
        )`,
        { like },
      );
    }

    if (clubSearchString?.trim()) {
      const raw = clubSearchString.trim();
      const n = Number(raw);
      const isNum = Number.isInteger(n) && n > 0;
      const isTime = /^([01]?\d|2[0-3]):[0-5]\d$/.test(raw);

      if (isNum) {
        qb.andWhere('club.number = :clubNum', { clubNum: n });
      } else if (isTime) {
        qb.andWhere('club.time LIKE :tlike', { tlike: `${raw}%` });
      } else {
        qb.andWhere('LOWER(CAST(club.weekday as char)) LIKE LOWER(:wdLike)', {
          wdLike: `%${raw}%`,
        });
      }
    }

    const sortMap: Record<string, string> = {
      number: 'club.number',
      weekday: 'club.weekday',
      time: 'club.time',
      createdAt: 'club.createdAt',
      updatedAt: 'club.updatedAt',
      city: 'address.city',
      state: 'address.state',
    };
    const orderBy = sortMap[sort] ?? 'club.number';
    const orderDir = (order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(orderBy, orderDir as 'ASC' | 'DESC');

    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async findAllSimple(ctx?: RoleCtx): Promise<ClubEntity[]> {
    const qb = this.buildClubBaseQB()
      .select([
        'club.id',
        'club.number',
        'club.weekday',
        'club.time',
        'address.id',
        'address.city',
        'address.state',
      ])
      .orderBy('club.number', 'ASC');

    this.applyRoleFilter(qb, ctx);

    return qb.getMany();
  }

  async list(ctx?: RoleCtx): Promise<ClubSelectOptionDto[]> {
    const qb = this.buildClubBaseQB().orderBy('club.number', 'ASC');
    this.applyRoleFilter(qb, ctx);
    const items = await qb.getMany();
    return items.map(toClubSelectOption);
  }

  async createClub(dto: CreateClubDto): Promise<ClubEntity> {
    return this.dataSource.transaction(async (manager) => {
      const clubRepo = manager.withRepository(this.clubRepo);
      const addressRepo = manager.withRepository(this.addressRepo);
      const coordRepo = manager.withRepository(this.coordRepo);
      const teacherRepo = manager.withRepository(this.teacherProfileRepo);
      const address = addressRepo.create(dto.address);
      await addressRepo.save(address);

      let coordinator: CoordinatorProfileEntity | null = null;
      if (dto.coordinatorProfileId) {
        coordinator = await coordRepo.findOne({
          where: { id: dto.coordinatorProfileId },
        });
        if (!coordinator) {
          throw new NotFoundException('CoordinatorProfile não encontrado');
        }
      }

      const club = clubRepo.create({
        number: dto.number,
        weekday: dto.weekday,
        time: dto.time ?? null,
        address,
        coordinator: coordinator ?? null,
      });

      try {
        await clubRepo.save(club);
      } catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY' || e?.code === '23505') {
          throw new ConflictException('Já existe um Club com esse número');
        }
        throw e;
      }

      if (dto.teacherProfileIds?.length) {
        const ids = Array.from(new Set(dto.teacherProfileIds));
        const teachers = await teacherRepo.find({
          where: { id: In(ids) },
          relations: { club: true },
        });

        if (teachers.length !== ids.length) {
          const found = new Set(teachers.map((t) => t.id));
          const missing = ids.filter((id) => !found.has(id));
          throw new NotFoundException(
            `TeacherProfile(s) não encontrado(s): ${missing.join(', ')}`,
          );
        }

        const alreadyAssigned = teachers.filter((t) => !!t.club);
        if (alreadyAssigned.length) {
          throw new BadRequestException(
            `Alguns TeacherProfiles já estão vinculados a outro Club: ${alreadyAssigned
              .map((t) => t.id)
              .join(', ')}`,
          );
        }

        await teacherRepo.update({ id: In(ids) }, { club: { id: club.id } as any });
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
      if (!club) throw new NotFoundException('Club não encontrado');

      if (dto.number !== undefined) club.number = dto.number as any;
      if (dto.weekday !== undefined) club.weekday = dto.weekday as any;

      if (dto.time !== undefined) {
        club.time = dto.time as any;
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
          club.coordinator = null as any;
        } else {
          const coordinator = await coordRepo.findOne({
            where: { id: dto.coordinatorProfileId },
          });
          if (!coordinator) {
            throw new NotFoundException('CoordinatorProfile não encontrado');
          }
          club.coordinator = coordinator;
        }
      }

      await clubRepo.save(club);

      if (dto.teacherProfileIds !== undefined) {
        await this.syncTeachersForClubTx(teacherRepo, club.id, dto.teacherProfileIds);
      }

      return this.findOneOrFailForResponseTx(manager, club.id);
    });
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
    if (!club) throw new NotFoundException('Club não encontrado');
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
      throw new NotFoundException(
        `TeacherProfile(s) não encontrado(s): ${missing.join(', ')}`,
      );
    }

    const attachedElsewhere = attachProfiles.filter(
      (p) => p.club && p.club.id !== clubId,
    );
    if (attachedElsewhere.length) {
      throw new BadRequestException(
        `Alguns TeacherProfiles já estão vinculados a outro Club: ${attachedElsewhere
          .map((t) => t.id)
          .join(', ')}`,
      );
    }

    if (attachProfiles.length) {
      await txTeacherRepo.update(
        { id: In(attachProfiles.map((p) => p.id)) },
        { club: { id: clubId } as any },
      );
    }

    if (toDetach.length) {
      await txTeacherRepo.update({ id: In(toDetach) }, { club: null as any });
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
      if (!club) throw new NotFoundException('Club não encontrado');

      if (club.teachers?.length) {
        await txTeacher.update(
          { id: In(club.teachers.map((t) => t.id)) },
          { club: null as any },
        );
      }

      if (club.coordinator) {
        await txClub.update({ id: club.id }, { coordinator: null as any });
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

    const hasGetExists = typeof (qb as any).getExists === 'function';
    return hasGetExists ? !!(await (qb as any).getExists()) : (await qb.getCount()) > 0;
  }

  async getCoordinatorProfileIdByUserId(userId: string): Promise<string | null> {
    const coord = await this.coordRepo.findOne({
      where: { user: { id: userId } as any },
      select: { id: true },
    });
    return coord?.id ?? null;
  }
}
