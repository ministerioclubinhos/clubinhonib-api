import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, SelectQueryBuilder } from 'typeorm';
import { PagelaEntity } from './entities/pagela.entity';
import { ChildEntity } from 'src/modules/children/entities/child.entity';
import { TeacherProfileEntity } from 'src/modules/teacher-profiles/entities/teacher-profile.entity/teacher-profile.entity';
import { PagelaFiltersDto } from './dto/pagela-filters.dto';

@Injectable()
export class PagelasRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PagelaEntity)
    private readonly repo: Repository<PagelaEntity>,
    @InjectRepository(ChildEntity)
    private readonly childRepo: Repository<ChildEntity>,
    @InjectRepository(TeacherProfileEntity)
    private readonly teacherRepo: Repository<TeacherProfileEntity>,
  ) { }

  private baseQB(): SelectQueryBuilder<PagelaEntity> {
    return this.repo
      .createQueryBuilder('p')
      .leftJoin('p.child', 'child')
      .addSelect(['child.id', 'child.name'])
      .leftJoin('p.teacher', 'teacher')
      .addSelect(['teacher.id']);
  }

  private applyFilters(
    qb: SelectQueryBuilder<PagelaEntity>,
    f?: PagelaFiltersDto,
  ) {
    if (!f) return qb;

    if (f.childId) {
      qb.andWhere('child.id = :childId', { childId: f.childId });
    }

    if (f.year != null) {
      qb.andWhere('p.year = :year', { year: f.year });
    }

    if (f.week != null) {
      console.log('f.week', f.week);

      qb.andWhere('p.week = :week', { week: f.week });
    }

    if (f.present) {
      qb.andWhere('p.present = :present', {
        present: f.present === 'true',
      });
    }

    if (f.didMeditation) {
      qb.andWhere('p.didMeditation = :didMeditation', {
        didMeditation: f.didMeditation === 'true',
      });
    }

    if (f.recitedVerse) {
      qb.andWhere('p.recitedVerse = :recitedVerse', {
        recitedVerse: f.recitedVerse === 'true',
      });
    }

    return qb;
  }

  async findAllSimple(filters?: PagelaFiltersDto): Promise<PagelaEntity[]> {
    const qb = this.applyFilters(this.baseQB(), filters)
      .orderBy('p.year', 'DESC')
      .addOrderBy('p.week', 'DESC')
      .addOrderBy('child.name', 'ASC');

    return qb.getMany();
  }

  async findAllPaginated(
    filters: PagelaFiltersDto | undefined,
    page: number,
    limit: number,
  ): Promise<{ items: PagelaEntity[]; total: number }> {
    const qb = this.applyFilters(this.baseQB(), filters);
    qb.orderBy('p.year', 'DESC').addOrderBy('p.week', 'DESC').addOrderBy('child.name', 'ASC');

    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();
    return { items, total };
  }

  async findOneOrFail(id: string): Promise<PagelaEntity> {
    const qb = this.baseQB().where('p.id = :id', { id });
    const item = await qb.getOne();
    if (!item) throw new NotFoundException('Pagela não encontrada');
    return item;
  }

  async findOneByChildYearWeekOrNull(childId: string, year: number, week: number): Promise<PagelaEntity | null> {
    return this.repo.findOne({
      where: { child: { id: childId }, year, week },
      relations: { child: true, teacher: true },
    });
  }

  async createOne(data: {
    childId: string;
    teacherProfileId?: string | null;
    referenceDate: string;
    year: number;
    week: number;
    present: boolean;
    didMeditation: boolean;
    recitedVerse: boolean;
    notes?: string | null;
  }): Promise<PagelaEntity> {
    return this.dataSource.transaction(async (manager) => {
      const txPagela = manager.withRepository(this.repo);
      const txChild = manager.withRepository(this.childRepo);
      const txTeacher = manager.withRepository(this.teacherRepo);

      const [child, teacher] = await Promise.all([
        txChild.findOne({ where: { id: data.childId } }),
        data.teacherProfileId ? txTeacher.findOne({ where: { id: data.teacherProfileId } }) : Promise.resolve(null),
      ]);
      if (!child) throw new NotFoundException('Child não encontrado');
      if (data.teacherProfileId && !teacher) throw new NotFoundException('TeacherProfile não encontrado');

      const existing = await txPagela.findOne({
        where: { child: { id: child.id }, year: data.year, week: data.week },
      });
      if (existing) {
        throw new BadRequestException('Já existe Pagela para esta criança nesta semana/ano');
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
        notes: data.notes ?? null,
      });
      return txPagela.save(entity);
    });
  }

  async updateOne(id: string, data: Partial<PagelaEntity>): Promise<PagelaEntity> {
    return this.dataSource.transaction(async (manager) => {
      const txPagela = manager.withRepository(this.repo);
      const entity = await txPagela.findOne({
        where: { id },
        relations: { child: true, teacher: true },
      });
      if (!entity) throw new NotFoundException('Pagela não encontrada');

      if (data.teacher) {
      }

      Object.assign(entity, data);
      try {
        return await txPagela.save(entity);
      } catch (e: any) {
        if (e?.code === 'ER_DUP_ENTRY') {
          throw new BadRequestException('Já existe Pagela para esta criança nesta semana/ano');
        }
        throw e;
      }
    });
  }

  async remove(id: string): Promise<void> {
    const exists = await this.repo.findOne({ where: { id } });
    if (!exists) return;
    await this.repo.delete(id);
  }
}
