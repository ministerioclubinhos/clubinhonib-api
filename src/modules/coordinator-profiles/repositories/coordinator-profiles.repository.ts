import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';

import { CoordinatorProfileEntity } from '../entities/coordinator-profile.entity/coordinator-profile.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity/club.entity';
import { UserEntity } from 'src/user/user.entity';
import { CoordinatorSimpleListDto, toCoordinatorSimple } from '../dto/coordinator-simple-list.dto';

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
  ) { }

  /* READs */

  async findAllWithClubsAndTeachers(): Promise<CoordinatorProfileEntity[]> {
    return this.coordRepo
      .createQueryBuilder('coord')
      .leftJoinAndSelect('coord.clubs', 'club')
      .leftJoinAndSelect('club.teachers', 'teachers')
      /* ↓↓↓ descer para os users ↓↓↓ */
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
      .orderBy('coord.createdAt', 'ASC')
      .addOrderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC')
      .getMany();
  }

  async findOneWithClubsAndTeachersOrFail(id: string): Promise<CoordinatorProfileEntity> {
    const coord = await this.coordRepo
      .createQueryBuilder('coord')
      .leftJoinAndSelect('coord.clubs', 'club')
      .leftJoinAndSelect('club.teachers', 'teachers')
      /* ↓↓↓ descer para os users ↓↓↓ */
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
      .where('coord.id = :id', { id })
      .orderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC')
      .getOne();

    if (!coord) throw new NotFoundException('CoordinatorProfile não encontrado');
    return coord;
  }

  async findByClubIdWithTeachersOrFail(clubId: string): Promise<CoordinatorProfileEntity> {
    const club = await this.clubRepo.findOne({
      where: { id: clubId },
      relations: { coordinator: true },
    });
    if (!club) throw new NotFoundException('Club não encontrado');
    if (!club.coordinator) {
      throw new NotFoundException('Este Club não possui coordenador vinculado');
    }

    // reusa o método acima (já com joins de users)
    return this.findOneWithClubsAndTeachersOrFail(club.coordinator.id);
  }

  /* WRITEs (sem criar/deletar coordinator) — inalterado */

  async assignClubToCoordinator(coordinatorId: string, clubId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const coordRepo = manager.withRepository(this.coordRepo);
      const clubRepo = manager.withRepository(this.clubRepo);

      const coordinator = await coordRepo.findOne({ where: { id: coordinatorId } });
      if (!coordinator) throw new NotFoundException('CoordinatorProfile não encontrado');

      const club = await clubRepo.findOne({ where: { id: clubId }, relations: { coordinator: true } });
      if (!club) throw new NotFoundException('Club não encontrado');

      if (club.coordinator && club.coordinator.id === coordinatorId) return;

      club.coordinator = coordinator;
      await clubRepo.save(club);
    });
  }

  async unassignClubFromCoordinator(coordinatorId: string, clubId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const clubRepo = manager.withRepository(this.clubRepo);

      const club = await clubRepo.findOne({ where: { id: clubId }, relations: { coordinator: true } });
      if (!club) throw new NotFoundException('Club não encontrado');

      if (!club.coordinator || club.coordinator.id !== coordinatorId) {
        throw new BadRequestException('Este Club não está vinculado a este coordenador');
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
      if (!from) throw new NotFoundException('CoordinatorProfile de origem não encontrado');
      if (!to) throw new NotFoundException('CoordinatorProfile de destino não encontrado');

      const club = await clubRepo.findOne({ where: { id: clubId }, relations: { coordinator: true } });
      if (!club) throw new NotFoundException('Club não encontrado');

      if (!club.coordinator || club.coordinator.id !== fromCoordinatorId) {
        throw new BadRequestException('O Club não está vinculado ao coordenador de origem');
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
    // user: só o que precisamos
    .leftJoin('coord.user', 'user')
    .addSelect(['user.id', 'user.name'])
    // clubs: manter selecionado para o Transform calcular `vinculado`
    .leftJoinAndSelect('coord.clubs', 'club')
    .orderBy('coord.createdAt', 'ASC')
    .addOrderBy('club.number', 'ASC')
    .getMany();

  // devolve somente os campos expostos no DTO
  return items.map(toCoordinatorSimple);
}
}
