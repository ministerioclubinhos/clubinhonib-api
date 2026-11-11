import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';

import {
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';

import { PagelaEntity } from '../entities/pagela.entity';
import { QueryPagelasDto } from '../dto/query-pagelas.dto';
import {
  PagelaAccessContext,
  PagelaCreateData,
  PagelaUpdateData,
} from '../types';
import {
  hasUnrestrictedScope,
  normalizedRole,
  parseWeekSearch,
} from '../utils';
import { UserRole } from 'src/core/auth/auth.types';

@Injectable()
export class PagelasRepository {
  constructor(
    private readonly dataSource: DataSource,

    @InjectRepository(PagelaEntity)
    private readonly pagelaRepo: Repository<PagelaEntity>,

    @InjectRepository(ChildEntity)
    private readonly childRepo: Repository<ChildEntity>,

    @InjectRepository(TeacherProfileEntity)
    private readonly teacherRepo: Repository<TeacherProfileEntity>,
  ) {}

  private baseQB(): SelectQueryBuilder<PagelaEntity> {
    return this.pagelaRepo
      .createQueryBuilder('pagela')
      .leftJoin('pagela.child', 'child')
      .addSelect(['child.id'])
      .leftJoin('pagela.teacher', 'teacher')
      .addSelect(['teacher.id']);
  }

  /**
   * Limita a consulta ao que o papel alcança.
   *
   * Administrador vê tudo. Coordenador vê as pagelas das crianças dos
   * clubinhos que coordena; professor, as do clubinho em que dá aula. Qualquer
   * outro papel não vê nada — e é isso que a condição impossível garante.
   */
  private applyAccessFilter(
    qb: SelectQueryBuilder<PagelaEntity>,
    context: PagelaAccessContext,
  ): void {
    if (hasUnrestrictedScope(context)) return;

    const role = normalizedRole(context);
    const userId = context.userId;

    if (!userId) {
      qb.andWhere('1 = 0');
      return;
    }

    qb.leftJoin('child.club', 'club');

    if (role === UserRole.COORDINATOR) {
      qb.leftJoin('club.coordinator', 'coordinator')
        .leftJoin('coordinator.user', 'coordinatorUser')
        .andWhere(
          '(coordinatorUser.id = :accessUserId OR child.club_id IS NULL)',
          {
            accessUserId: userId,
          },
        )
        .distinct(true);
      return;
    }

    if (role === UserRole.TEACHER) {
      qb.leftJoin('club.teachers', 'teacherProfile')
        .leftJoin('teacherProfile.user', 'teacherUser')
        .andWhere('(teacherUser.id = :accessUserId OR child.club_id IS NULL)', {
          accessUserId: userId,
        })
        .distinct(true);
      return;
    }

    qb.andWhere('1 = 0');
  }

  private applyFilters(
    qb: SelectQueryBuilder<PagelaEntity>,
    query: QueryPagelasDto,
  ): void {
    if (query.childId) {
      qb.andWhere('child.id = :childId', { childId: query.childId });
    }

    if (query.year != null) {
      qb.andWhere('pagela.year = :year', { year: query.year });
    }

    if (query.week != null) {
      qb.andWhere('pagela.week = :week', { week: query.week });
    }

    // A busca livre entende `2026-48`, `2026` ou `48`.
    const search = parseWeekSearch(query.searchString);
    if (search.year != null) {
      qb.andWhere('pagela.year = :searchYear', { searchYear: search.year });
    }
    if (search.week != null) {
      qb.andWhere('pagela.week = :searchWeek', { searchWeek: search.week });
    }

    if (query.present != null) {
      qb.andWhere('pagela.present = :present', { present: query.present });
    }

    if (query.didMeditation != null) {
      qb.andWhere('pagela.didMeditation = :didMeditation', {
        didMeditation: query.didMeditation,
      });
    }

    if (query.recitedVerse != null) {
      qb.andWhere('pagela.recitedVerse = :recitedVerse', {
        recitedVerse: query.recitedVerse,
      });
    }
  }

  private applyOrder(qb: SelectQueryBuilder<PagelaEntity>): void {
    qb.orderBy('pagela.year', 'DESC')
      .addOrderBy('pagela.week', 'DESC')
      .addOrderBy('pagela.referenceDate', 'DESC');
  }

  async findAll(
    query: QueryPagelasDto,
    context: PagelaAccessContext,
  ): Promise<PagelaEntity[]> {
    const qb = this.baseQB();
    this.applyAccessFilter(qb, context);
    this.applyFilters(qb, query);
    this.applyOrder(qb);

    return qb.getMany();
  }

  async findAllPaginated(
    query: QueryPagelasDto,
    context: PagelaAccessContext,
    page: number,
    limit: number,
  ): Promise<{ items: PagelaEntity[]; total: number }> {
    const qb = this.baseQB();
    this.applyAccessFilter(qb, context);
    this.applyFilters(qb, query);
    this.applyOrder(qb);

    const [items, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { items, total };
  }

  /** A pagela dentro do alcance de quem pede, ou `null`. */
  async findOneInScope(
    id: string,
    context: PagelaAccessContext,
  ): Promise<PagelaEntity | null> {
    const qb = this.baseQB().where('pagela.id = :id', { id });
    this.applyAccessFilter(qb, context);

    return qb.getOne();
  }

  /**
   * A criança está sob o alcance de quem pede.
   *
   * Vale para escrita: sem isso, um coordenador conseguia criar ou apagar
   * pagela de criança de outro clubinho só sabendo o id dela.
   */
  async childIsWithinReach(
    childId: string,
    context: PagelaAccessContext,
  ): Promise<boolean> {
    if (hasUnrestrictedScope(context)) return true;

    const role = normalizedRole(context);
    const userId = context.userId;
    if (!userId) return false;

    const qb = this.childRepo
      .createQueryBuilder('child')
      .leftJoin('child.club', 'club')
      .where('child.id = :childId', { childId });

    if (role === UserRole.COORDINATOR) {
      qb.leftJoin('club.coordinator', 'coordinator')
        .leftJoin('coordinator.user', 'coordinatorUser')
        .andWhere(
          '(coordinatorUser.id = :accessUserId OR child.club_id IS NULL)',
          {
            accessUserId: userId,
          },
        );
    } else if (role === UserRole.TEACHER) {
      qb.leftJoin('club.teachers', 'teacherProfile')
        .leftJoin('teacherProfile.user', 'teacherUser')
        .andWhere('(teacherUser.id = :accessUserId OR child.club_id IS NULL)', {
          accessUserId: userId,
        });
    } else {
      return false;
    }

    return (await qb.getCount()) > 0;
  }

  /** A criança está ativa? Criança que não existe conta como inativa. */
  async childIsActive(childId: string): Promise<boolean> {
    return (
      (await this.childRepo.count({ where: { id: childId, isActive: true } })) >
      0
    );
  }

  async createOne(data: PagelaCreateData): Promise<PagelaEntity> {
    return this.dataSource.transaction(async (manager) => {
      const txPagela = manager.withRepository(this.pagelaRepo);
      const txChild = manager.withRepository(this.childRepo);
      const txTeacher = manager.withRepository(this.teacherRepo);

      const [child, teacher] = await Promise.all([
        txChild.findOne({ where: { id: data.childId } }),
        data.teacherProfileId
          ? txTeacher.findOne({ where: { id: data.teacherProfileId } })
          : Promise.resolve(null),
      ]);

      if (!child) {
        throw new AppNotFoundException(
          ErrorCode.CHILD_NOT_FOUND,
          'Criança não encontrada',
        );
      }

      if (data.teacherProfileId && !teacher) {
        throw new AppNotFoundException(
          ErrorCode.TEACHER_NOT_FOUND,
          'Perfil de professor não encontrado',
        );
      }

      const entity = txPagela.create({
        child,
        teacher: teacher ?? null,
        referenceDate: data.referenceDate,
        year: data.year,
        week: data.week,
        present: data.present,
        didMeditation: data.didMeditation,
        recitedVerse: data.recitedVerse,
        notes: data.notes,
      });

      return this.saveOrFailOnDuplicate(txPagela, entity);
    });
  }

  async updateOne(id: string, data: PagelaUpdateData): Promise<PagelaEntity> {
    return this.dataSource.transaction(async (manager) => {
      const txPagela = manager.withRepository(this.pagelaRepo);
      const txTeacher = manager.withRepository(this.teacherRepo);

      const entity = await txPagela.findOne({
        where: { id },
        relations: { child: true, teacher: true },
      });

      if (!entity) {
        throw new AppNotFoundException(
          ErrorCode.PAGELA_NOT_FOUND,
          'Pagela não encontrada',
        );
      }

      if (data.referenceDate !== undefined) {
        entity.referenceDate = data.referenceDate;
      }
      if (data.year !== undefined) entity.year = data.year;
      if (data.week !== undefined) entity.week = data.week;
      if (data.present !== undefined) entity.present = data.present;
      if (data.didMeditation !== undefined) {
        entity.didMeditation = data.didMeditation;
      }
      if (data.recitedVerse !== undefined) {
        entity.recitedVerse = data.recitedVerse;
      }
      // `null` chega aqui para limpar a observação, e precisa ser gravado.
      if (data.notes !== undefined) entity.notes = data.notes;

      if (data.teacherProfileId !== undefined) {
        if (data.teacherProfileId === null) {
          entity.teacher = null;
        } else {
          const teacher = await txTeacher.findOne({
            where: { id: data.teacherProfileId },
          });
          if (!teacher) {
            throw new AppNotFoundException(
              ErrorCode.TEACHER_NOT_FOUND,
              'Perfil de professor não encontrado',
            );
          }
          entity.teacher = teacher;
        }
      }

      return this.saveOrFailOnDuplicate(txPagela, entity);
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.pagelaRepo.delete(id);
  }

  /**
   * Grava traduzindo a violação da unicidade em conflito.
   *
   * O banco garante uma pagela por criança em cada semana do ano; aqui a
   * violação vira uma resposta que o cliente entende.
   */
  private async saveOrFailOnDuplicate(
    repo: Repository<PagelaEntity>,
    entity: PagelaEntity,
  ): Promise<PagelaEntity> {
    try {
      return await repo.save(entity);
    } catch (error: unknown) {
      const code = (error as { code?: string })?.code;
      if (code === 'ER_DUP_ENTRY' || code === '23505') {
        throw new AppConflictException(
          ErrorCode.RESOURCE_ALREADY_EXISTS,
          'Já existe pagela para esta criança nesta semana e ano',
        );
      }
      throw error;
    }
  }
}
