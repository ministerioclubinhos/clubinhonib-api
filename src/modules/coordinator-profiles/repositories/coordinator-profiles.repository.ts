import { Injectable } from '@nestjs/common';
import {
  AppBusinessException,
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  Repository,
  SelectQueryBuilder,
  EntityManager,
} from 'typeorm';

import { CoordinatorProfileEntity } from '../entities/coordinator-profile.entity/coordinator-profile.entity';
import { ClubEntity } from 'src/modules/clubs/entities/club.entity';
import { UserEntity } from 'src/core/user/entities/user.entity';
import {
  CoordinatorSimpleListDto,
  toCoordinatorSimple,
} from '../dto/coordinator-simple-list.dto';
import { CoordinatorProfilesQueryDto } from '../dto/coordinator-profiles.query.dto';
import {
  COORDINATORS_DEFAULT_LIMIT,
  COORDINATORS_DEFAULT_ORDER,
  COORDINATORS_DEFAULT_PAGE,
  COORDINATORS_DEFAULT_SORT,
  COORDINATORS_MAX_LIMIT,
  COORDINATOR_SORT_COLUMNS,
  CoordinatorSortField,
  SortOrder,
} from '../constants';

type SortDir = 'ASC' | 'DESC';

/** Uma página de coordenadores, como o banco a devolve. */
export interface PaginatedCoordinators {
  items: CoordinatorProfileEntity[];
  total: number;
  page: number;
  limit: number;
}

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

  /**
   * A situação da conta não peneira a listagem: um coordenador suspenso
   * continua sendo gerenciado — e continua com os clubinhos dele. Quem filtra é
   * o parâmetro `active`, que lê o perfil.
   */
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
      ]);
  }

  private baseIdsQuery(): SelectQueryBuilder<CoordinatorProfileEntity> {
    return this.coordRepo
      .createQueryBuilder('coord')
      .leftJoin('coord.user', 'coord_user');
  }

  /**
   * Coluna do banco para o campo de ordenação pedido.
   *
   * Só um nome da tabela de constantes chega ao SQL; o valor recebido nunca é
   * interpolado.
   */
  private resolveSort(sort?: CoordinatorSortField): string {
    return (
      COORDINATOR_SORT_COLUMNS[sort ?? COORDINATORS_DEFAULT_SORT] ??
      COORDINATOR_SORT_COLUMNS[COORDINATORS_DEFAULT_SORT]
    );
  }

  private applyFilters(
    qb: SelectQueryBuilder<CoordinatorProfileEntity>,
    params: CoordinatorProfilesQueryDto,
  ) {
    const text = (params.searchString ?? params.q)?.trim();
    const { active, hasClubs, clubNumber } = params;

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

  async findPageWithFilters(
    query: CoordinatorProfilesQueryDto,
  ): Promise<PaginatedCoordinators> {
    const {
      page = COORDINATORS_DEFAULT_PAGE,
      sort = COORDINATORS_DEFAULT_SORT,
      order = COORDINATORS_DEFAULT_ORDER,
    } = query;
    const limit = Math.min(
      Math.max(query.limit ?? COORDINATORS_DEFAULT_LIMIT, 1),
      COORDINATORS_MAX_LIMIT,
    );

    const sortColumn = this.resolveSort(sort);
    const sortDir: SortDir = order === SortOrder.ASC ? 'ASC' : 'DESC';
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
      // O desempate por id mantém a paginação estável quando duas linhas têm o
      // mesmo valor na coluna ordenada.
      .addOrderBy('coord.id', 'ASC')
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

  async findOneWithClubsAndTeachersOrFail(
    id: string,
  ): Promise<CoordinatorProfileEntity> {
    const coord = await this.buildCoordinatorBaseQB()
      .andWhere('coord.id = :id', { id })
      .orderBy('club.number', 'ASC')
      .addOrderBy('teachers.createdAt', 'ASC')
      .getOne();

    if (!coord)
      throw new AppNotFoundException(
        ErrorCode.COORDINATOR_NOT_FOUND,
        'Perfil de coordenador não encontrado',
      );
    return coord;
  }

  async findByClubIdWithTeachersOrFail(
    clubId: string,
  ): Promise<CoordinatorProfileEntity> {
    const club = await this.clubRepo.findOne({
      where: { id: clubId },
      relations: { coordinator: true },
    });
    if (!club)
      throw new AppNotFoundException(
        ErrorCode.CLUB_NOT_FOUND,
        'Clubinho não encontrado',
      );
    if (!club.coordinator) {
      throw new AppNotFoundException(
        ErrorCode.COORDINATOR_NOT_FOUND,
        'Este Clubinho não possui coordenador vinculado',
      );
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

      const coordinator = await coordRepo.findOne({
        where: { id: coordinatorId },
      });
      if (!coordinator)
        throw new AppNotFoundException(
          ErrorCode.COORDINATOR_NOT_FOUND,
          'Perfil de coordenador não encontrado',
        );

      const club = await clubRepo.findOne({
        where: { id: clubId },
        relations: { coordinator: true },
      });
      if (!club)
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );

      if (club.coordinator?.id === coordinatorId) return;

      // Um clubinho tem um coordenador só. Reatribuí-lo aqui tiraria o
      // clubinho de outra pessoa sem que ninguém pedisse: quem quer transferir
      // usa `move-club`, que nomeia origem e destino.
      if (club.coordinator) {
        throw new AppConflictException(
          ErrorCode.RESOURCE_CONFLICT,
          'Este Clubinho já tem coordenador. Use a transferência para passá-lo a outro coordenador.',
          { clubId, currentCoordinatorProfileId: club.coordinator.id },
        );
      }

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
      if (!club)
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );

      if (!club.coordinator || club.coordinator.id !== coordinatorId) {
        throw new AppBusinessException(
          ErrorCode.PROFILE_INVALID_OPERATION,
          'Este Clubinho não está vinculado a este coordenador',
        );
      }

      club.coordinator = null;
      await clubRepo.save(club);
    });
  }

  async moveClubBetweenCoordinators(
    fromCoordinatorId: string,
    clubId: string,
    toCoordinatorId: string,
  ): Promise<void> {
    if (fromCoordinatorId === toCoordinatorId) {
      throw new AppBusinessException(
        ErrorCode.INVALID_INPUT,
        'Coordenadores de origem e destino são iguais',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const coordRepo = manager.withRepository(this.coordRepo);
      const clubRepo = manager.withRepository(this.clubRepo);

      const [from, to] = await Promise.all([
        coordRepo.findOne({ where: { id: fromCoordinatorId } }),
        coordRepo.findOne({ where: { id: toCoordinatorId } }),
      ]);
      if (!from)
        throw new AppNotFoundException(
          ErrorCode.COORDINATOR_NOT_FOUND,
          'Perfil de coordenador de origem não encontrado',
        );
      if (!to)
        throw new AppNotFoundException(
          ErrorCode.COORDINATOR_NOT_FOUND,
          'Perfil de coordenador de destino não encontrado',
        );

      const club = await clubRepo.findOne({
        where: { id: clubId },
        relations: { coordinator: true },
      });
      if (!club)
        throw new AppNotFoundException(
          ErrorCode.CLUB_NOT_FOUND,
          'Clubinho não encontrado',
        );

      if (!club.coordinator || club.coordinator.id !== fromCoordinatorId) {
        throw new AppBusinessException(
          ErrorCode.PROFILE_INVALID_OPERATION,
          'O Clubinho não está vinculado ao coordenador de origem',
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
      if (!user)
        throw new AppNotFoundException(
          ErrorCode.USER_NOT_FOUND,
          'Usuário não encontrado',
        );

      const existing = await txCoord.findOne({
        where: { user: { id: userId } },
      });
      if (existing) return existing;

      const entity = txCoord.create({ user: user, active: true });
      return txCoord.save(entity);
    });
  }

  /**
   * Liga ou desliga o perfil sem mexer nos clubinhos.
   *
   * Desativar um coordenador apagava o perfil e soltava todos os clubinhos
   * dele; reativar devolvia um perfil vazio. A criação já mantinha o perfil de
   * um usuário inativo, então as duas rotinas discordavam.
   */
  async setActiveByUserId(userId: string, active: boolean): Promise<void> {
    const profile = await this.coordRepo.findOne({
      where: { user: { id: userId } },
    });
    if (!profile || profile.active === active) return;

    await this.coordRepo.update(profile.id, { active });
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
          .set({ coordinator: null })
          .where('coordinator_profile_id = :id', { id: coord.id })
          .execute();
      }

      await txCoord.delete(coord.id);
    });
  }

  /**
   * Os coordenadores em atividade e os clubinhos de cada um.
   *
   * Existe para o resumo semanal, que precisa varrer todos de uma vez — as
   * leituras existentes ou paginam (`findPageWithFilters`) ou partem de um id
   * conhecido. Traz o `user` porque o resumo vai por e-mail, e o e-mail está no
   * usuário, não no perfil.
   *
   * Filtra pelas duas situações: o perfil de coordenador pode estar ativo com a
   * conta suspensa, e nesse caso não há a quem escrever.
   */
  async findAllActiveWithClubs(): Promise<CoordinatorProfileEntity[]> {
    return this.coordRepo
      .createQueryBuilder('coord')
      .leftJoin('coord.user', 'user')
      .addSelect(['user.id', 'user.name', 'user.email'])
      .leftJoinAndSelect('coord.clubs', 'club')
      .where('user.active = true')
      .andWhere('coord.active = true')
      .orderBy('coord.createdAt', 'ASC')
      .addOrderBy('club.number', 'ASC')
      .getMany();
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
