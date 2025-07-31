// src/modules/clubs/repositories/clubs.repository.ts
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

  /* ========== helpers de seleção segura (evitar password/refreshToken) ========== */

  private buildClubBaseQB(manager?: EntityManager): SelectQueryBuilder<ClubEntity> {
    const repo = manager ? manager.getRepository(ClubEntity) : this.clubRepo;
    return repo
      .createQueryBuilder('club')
      .leftJoinAndSelect('club.address', 'address')
      .leftJoinAndSelect('club.coordinator', 'coordinator')
      .leftJoinAndSelect('club.teachers', 'teachers')
      // users do coordinator e dos teachers (join simples + seleção de campos não sensíveis)
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

  /* ========== READS ========== */

  async findByIdWithRelationsOrFail(id: string): Promise<ClubEntity> {
    // versão com relations object (inclui user)
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

  /** GET /:id — com relações necessárias pro DTO de resposta (inclui users) */
  async findOneOrFailForResponse(id: string): Promise<ClubEntity> {
    const qb = this.buildClubBaseQB()
      .where('club.id = :id', { id })
      .orderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC');

    const club = await qb.getOne();
    if (!club) throw new NotFoundException('Club não encontrado');
    return club;
  }

  /** Versão “dentro da transação” (evita 404 logo após criar/atualizar) */
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

  /** GET / — paginação + filtros/ordenação (inclui users) */
  async findAllPaginated(
    q: QueryClubsDto,
  ): Promise<{ items: ClubEntity[]; total: number }> {
    const {
      page = 1,
      limit = 10,
      q: term,
      number,
      weekday,
      city,
      state,
      district,
      postalCode,
      coordinatorProfileId,
      coordinatorUserId,
      teacherProfileId,
      teacherUserId,
      hasCoordinator,
      sort = 'number',
      order = 'ASC',
    } = q;

    const qb = this.buildClubBaseQB().distinct(true);

    // Filtros simples
    if (number) qb.andWhere('club.number = :num', { num: number });
    if (weekday) qb.andWhere('club.weekday = :weekday', { weekday });

    // Endereço (LIKE case-insensitive)
    if (city?.trim()) {
      qb.andWhere('LOWER(address.city) LIKE LOWER(:city)', {
        city: `%${city.trim()}%`,
      });
    }
    if (state?.trim()) {
      qb.andWhere('LOWER(address.state) LIKE LOWER(:state)', {
        state: `%${state.trim()}%`,
      });
    }
    if (district?.trim()) {
      qb.andWhere('LOWER(address.district) LIKE LOWER(:district)', {
        district: `%${district.trim()}%`,
      });
    }
    if (postalCode?.trim()) {
      qb.andWhere('LOWER(address.postalCode) LIKE LOWER(:postal)', {
        postal: `%${postalCode.trim()}%`,
      });
    }

    // Coordenador
    if (typeof hasCoordinator === 'string') {
      if (hasCoordinator === 'true') qb.andWhere('club.coordinator IS NOT NULL');
      if (hasCoordinator === 'false') qb.andWhere('club.coordinator IS NULL');
    }
    if (coordinatorProfileId) {
      qb.andWhere('coordinator.id = :coordId', { coordId: coordinatorProfileId });
    }
    if (coordinatorUserId) {
      qb.andWhere('coord_user.id = :coordUserId', { coordUserId: coordinatorUserId });
    }

    // Teacher
    if (teacherProfileId) {
      qb.andWhere('teachers.id = :teacherProfileId', { teacherProfileId });
    }
    if (teacherUserId) {
      qb.andWhere('teacher_user.id = :teacherUserId', { teacherUserId });
    }

    // Busca livre (coord/teacher nome/email + endereço). Se for número, também compara com club.number
    if (term?.trim()) {
      const like = `%${term.trim()}%`;
      const n = Number(term);
      const isNum = Number.isInteger(n) && n > 0;

      const orParts: string[] = [
        'LOWER(address.street) LIKE LOWER(:like)',
        'LOWER(address.district) LIKE LOWER(:like)',
        'LOWER(address.city) LIKE LOWER(:like)',
        'LOWER(address.state) LIKE LOWER(:like)',
        'LOWER(address.postalCode) LIKE LOWER(:like)',
        'LOWER(coord_user.name) LIKE LOWER(:like)',
        'LOWER(coord_user.email) LIKE LOWER(:like)',
        'LOWER(teacher_user.name) LIKE LOWER(:like)',
        'LOWER(teacher_user.email) LIKE LOWER(:like)',
      ];

      if (isNum) {
        orParts.push('club.number = :likeNum');
        qb.andWhere(`(${orParts.join(' OR ')})`, { like, likeNum: n });
      } else {
        qb.andWhere(`(${orParts.join(' OR ')})`, { like });
      }
    }

    // Ordenação segura
    const sortMap: Record<string, string> = {
      number: 'club.number',
      weekday: 'club.weekday',
      createdAt: 'club.createdAt',
      updatedAt: 'club.updatedAt',
      city: 'address.city',
      state: 'address.state',
    };
    const orderBy = sortMap[sort] ?? 'club.number';
    const orderDir = (order || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    qb.orderBy(orderBy, orderDir as 'ASC' | 'DESC');

    // Paginação
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  /* ========== WRITES ========== */

  async createClub(dto: CreateClubDto): Promise<ClubEntity> {
    return this.dataSource.transaction(async (manager) => {
      const clubRepo = manager.withRepository(this.clubRepo);
      const addressRepo = manager.withRepository(this.addressRepo);
      const coordRepo = manager.withRepository(this.coordRepo);

      // 1) Address
      const address = addressRepo.create(dto.address);
      await addressRepo.save(address);

      // 2) Coordinator (opcional)
      let coordinator: CoordinatorProfileEntity | null = null;
      if (dto.coordinatorProfileId) {
        coordinator = await coordRepo.findOne({
          where: { id: dto.coordinatorProfileId },
        });
        if (!coordinator) {
          throw new NotFoundException('CoordinatorProfile não encontrado');
        }
      }

      // 3) Cria Club
      const club = clubRepo.create({
        number: dto.number,
        weekday: dto.weekday,
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

      // 4) Retorna com joins profundos usando o MESMO manager (mesma transação)
      return this.findOneOrFailForResponseTx(manager, club.id);
    });
  }

  async updateClub(id: string, dto: UpdateClubDto): Promise<ClubEntity> {
    return this.dataSource.transaction(async (manager) => {
      const clubRepo = manager.withRepository(this.clubRepo);
      const addressRepo = manager.withRepository(this.addressRepo);
      const coordRepo = manager.withRepository(this.coordRepo);
      const teacherRepo = manager.withRepository(this.teacherProfileRepo);

      // 1) Load
      const club = await clubRepo.findOne({
        where: { id },
        relations: { address: true, coordinator: true, teachers: true },
      });
      if (!club) throw new NotFoundException('Club não encontrado');

      // 2) Campos simples
      if (dto.number !== undefined) club.number = dto.number as any;
      if (dto.weekday !== undefined) club.weekday = dto.weekday as any;

      // 3) Address (patch parcial; cria se não existir)
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

      // 4) Coordinator (nullable permitido)
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

      // 5) Save base
      await clubRepo.save(club);

      // 6) Teachers (sync)
      if (dto.teacherProfileIds !== undefined) {
        await this.syncTeachersForClubTx(teacherRepo, club.id, dto.teacherProfileIds);
      }

      // 7) Retorna com users carregados (usando o MESMO manager)
      return this.findOneOrFailForResponseTx(manager, club.id);
    });
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

      // se quiser remover o address órfão, descomente:
      // if (addressId) {
      //   await txAddress.delete(addressId);
      // }
    });
  }
    /** GET /all — versão simples (sem users; só endereço básico) */
  async findAllSimple(): Promise<ClubEntity[]> {
    return this.clubRepo.find({
      relations: { address: true },
      order: { number: 'ASC' },
    });
  }

}
