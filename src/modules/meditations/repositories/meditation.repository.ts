import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { MeditationEntity } from '../entities/meditation.entity';
import { DayEntity } from '../entities/day.entity';
import {
  MEDITATIONS_DEFAULT_LIMIT,
  MEDITATIONS_DEFAULT_PAGE,
  MEDITATION_DEFAULT_ORDER,
  MEDITATION_DEFAULT_SORT,
  MEDITATION_RELATIONS,
  MEDITATION_SORT_COLUMNS,
} from '../constants';
import { QueryMeditationsDto } from '../dto/query-meditations.dto';
import { MeditationContent } from '../types';

@Injectable()
export class MeditationRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MeditationEntity)
    private readonly meditationRepo: Repository<MeditationEntity>,
    @InjectRepository(DayEntity)
    private readonly dayRepo: Repository<DayEntity>,
  ) {}

  /**
   * Roda um conjunto de escritas numa transação só.
   *
   * Abrir e fechar transação é acesso ao banco, e mora aqui. O caso de uso
   * continua decidindo o que é atômico, mas não conhece `QueryRunner`, commit
   * nem rollback.
   */
  async runInTransaction<T>(
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.dataSource.transaction(work);
  }

  private scoped(manager?: EntityManager): Repository<MeditationEntity> {
    return manager
      ? manager.getRepository(MeditationEntity)
      : this.meditationRepo;
  }

  private scopedDays(manager?: EntityManager): Repository<DayEntity> {
    return manager ? manager.getRepository(DayEntity) : this.dayRepo;
  }

  /**
   * Aplica busca e recorte de período.
   *
   * A busca alcança os dias por uma subconsulta: juntar `days` no `WHERE` da
   * própria listagem multiplicaria as linhas e estragaria a contagem total.
   */
  private applyFilters(
    qb: SelectQueryBuilder<MeditationEntity>,
    query: QueryMeditationsDto,
    today: string,
  ): void {
    const search = query.searchString?.trim();

    if (search) {
      // O vínculo é feito pela própria relação, e não pelo nome da coluna de
      // chave estrangeira: é o TypeORM que sabe como ela se chama.
      const diaCombina = qb
        .subQuery()
        .select('1')
        .from(DayEntity, 'day')
        .innerJoin('day.meditation', 'diaMeditacao')
        .where('diaMeditacao.id = meditation.id')
        .andWhere(
          '(LOWER(day.topic) LIKE LOWER(:search) OR LOWER(day.verse) LIKE LOWER(:search))',
        )
        .getQuery();

      qb.andWhere(
        `(LOWER(meditation.topic) LIKE LOWER(:search) OR EXISTS ${diaCombina})`,
        { search: `%${search}%` },
      );
    }

    if (query.period === 'current') {
      qb.andWhere('meditation.startDate <= :today', { today }).andWhere(
        'meditation.endDate >= :today',
        { today },
      );
    }

    if (query.period === 'upcoming') {
      qb.andWhere('meditation.startDate > :today', { today });
    }

    if (query.period === 'past') {
      qb.andWhere('meditation.endDate < :today', { today });
    }
  }

  /**
   * Página de meditações filtrada no banco.
   *
   * `today` chega de fora porque o dia corrente é resolvido no fuso da
   * aplicação, não no do servidor de banco.
   */
  async findAllPaginated(
    query: QueryMeditationsDto,
    today: string,
  ): Promise<{ items: MeditationEntity[]; total: number }> {
    const {
      page = MEDITATIONS_DEFAULT_PAGE,
      limit = MEDITATIONS_DEFAULT_LIMIT,
      sort = MEDITATION_DEFAULT_SORT,
      order = MEDITATION_DEFAULT_ORDER,
    } = query;

    const qb = this.meditationRepo
      .createQueryBuilder('meditation')
      .leftJoinAndSelect('meditation.days', 'days');

    this.applyFilters(qb, query, today);

    qb.orderBy(MEDITATION_SORT_COLUMNS[sort], order)
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total };
  }

  async findOneWithDays(
    id: string,
    manager?: EntityManager,
  ): Promise<MeditationEntity | null> {
    return this.scoped(manager).findOne({
      where: { id },
      relations: [...MEDITATION_RELATIONS],
    });
  }

  /**
   * Primeira meditação cujo período cruza o intervalo informado. Duas faixas se
   * sobrepõem quando uma começa antes do fim da outra e termina depois do
   * início dela — resolver isso no banco evita carregar a tabela inteira.
   */
  async findOverlapping(
    startDate: string,
    endDate: string,
    excludeId?: string,
    manager?: EntityManager,
  ): Promise<MeditationEntity | null> {
    return this.scoped(manager).findOne({
      where: {
        startDate: LessThanOrEqual(endDate),
        endDate: MoreThanOrEqual(startDate),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
      relations: [...MEDITATION_RELATIONS],
    });
  }

  /** Meditação cujo período contém a data informada. */
  async findByDate(date: string): Promise<MeditationEntity | null> {
    return this.meditationRepo.findOne({
      where: {
        startDate: LessThanOrEqual(date),
        endDate: MoreThanOrEqual(date),
      },
      relations: [...MEDITATION_RELATIONS],
    });
  }

  async createMeditation(
    content: MeditationContent,
    days: Pick<DayEntity, 'day' | 'verse' | 'topic'>[],
    manager?: EntityManager,
  ): Promise<MeditationEntity> {
    const repository = this.scoped(manager);
    const meditation = repository.create({ ...content, days });
    return repository.save(meditation);
  }

  async saveMeditation(
    meditation: MeditationEntity,
    manager?: EntityManager,
  ): Promise<MeditationEntity> {
    return this.scoped(manager).save(meditation);
  }

  async removeMeditation(
    meditation: MeditationEntity,
    manager?: EntityManager,
  ): Promise<void> {
    await this.scoped(manager).remove(meditation);
  }

  async removeDays(days: DayEntity[], manager?: EntityManager): Promise<void> {
    if (days.length === 0) return;
    await this.scopedDays(manager).remove(days);
  }

  async saveDays(
    meditation: MeditationEntity,
    days: Pick<DayEntity, 'day' | 'verse' | 'topic'>[],
    manager?: EntityManager,
  ): Promise<DayEntity[]> {
    const repository = this.scopedDays(manager);
    const entities = days.map((day) =>
      repository.create({ ...day, meditation }),
    );
    return repository.save(entities);
  }
}
