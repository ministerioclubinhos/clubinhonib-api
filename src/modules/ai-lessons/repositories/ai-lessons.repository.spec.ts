import { AiLessonsRepository } from './ai-lessons.repository';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageType, LessonStatus } from '../enums/lesson.enums';
import { LessonSortField, SortOrder } from '../dto/query-lessons.dto';

describe('AiLessonsRepository relation binding', () => {
  let repository: AiLessonsRepository;
  let mockLessonsRepo: { save: jest.Mock; create: jest.Mock };
  let mockStagesRepo: { save: jest.Mock; create: jest.Mock };
  let mockVersionsRepo: { save: jest.Mock; create: jest.Mock };

  beforeEach(() => {
    mockLessonsRepo = {
      save: jest.fn((val) => Promise.resolve(val)),
      create: jest.fn(),
    };
    mockStagesRepo = {
      save: jest.fn((val) => Promise.resolve(val)),
      create: jest.fn(),
    };
    mockVersionsRepo = {
      save: jest.fn((val) => Promise.resolve(val)),
      create: jest.fn(),
    };

    repository = new AiLessonsRepository(
      {} as unknown as import('typeorm').DataSource,
      mockLessonsRepo as unknown as import('typeorm').Repository<LessonEntity>,
      mockStagesRepo as unknown as import('typeorm').Repository<LessonStageEntity>,
      mockVersionsRepo as unknown as import('typeorm').Repository<LessonVersionEntity>,
      {} as unknown as import('typeorm').Repository<
        import('../entities/lesson-comment.entity').LessonCommentEntity
      >,
    );
  });

  it('binds stage to versions on saveStage so stage_id relation is intact', async () => {
    const stage = {
      id: 'stage-123',
      versions: [
        { id: 'v1', versionNumber: 1, stage: undefined, stageId: undefined },
      ] as unknown as LessonVersionEntity[],
    } as LessonStageEntity;

    await repository.saveStage(stage);

    expect(stage.versions[0].stage).toBe(stage);
    expect(stage.versions[0].stageId).toBe('stage-123');
    expect(mockStagesRepo.save).toHaveBeenCalledWith(stage);
  });

  it('binds stage to versions on saveLesson so cascaded stage_id relation is intact', async () => {
    const stage = {
      id: 'stage-456',
      versions: [
        { id: 'v2', versionNumber: 1, stage: undefined, stageId: undefined },
      ] as unknown as LessonVersionEntity[],
    } as LessonStageEntity;

    const lesson = {
      id: 'lesson-1',
      stages: [stage],
    } as LessonEntity;

    await repository.saveLesson(lesson);

    expect(lesson.stages[0].versions[0].stage).toBe(stage);
    expect(lesson.stages[0].versions[0].stageId).toBe('stage-456');
    expect(mockLessonsRepo.save).toHaveBeenCalledWith(lesson);
  });

  it('T-B14: filtra lista por múltiplos status no servidor e calcula total/página coerentemente', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([
        [
          { id: 'lesson-1', status: 'IN_REVIEW' },
          { id: 'lesson-2', status: 'PACKAGE_READY' },
        ],
        2,
      ]),
    };
    (
      mockLessonsRepo as unknown as { createQueryBuilder: jest.Mock }
    ).createQueryBuilder = jest.fn().mockReturnValue(qb);

    const result = await repository.findDraftsPaginated({
      statuses: [LessonStatus.PACKAGE_READY, LessonStatus.IN_REVIEW],
      search: 'Páscoa',
      page: 1,
      limit: 10,
      sort: LessonSortField.UPDATED_AT,
      order: SortOrder.DESC,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      'lesson.status IN (:...statuses)',
      {
        statuses: [LessonStatus.PACKAGE_READY, LessonStatus.IN_REVIEW],
      },
    );
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('LOWER(lesson.theme) LIKE LOWER(:search)'),
      { search: '%Páscoa%' },
    );
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });

  it('trata % e _ da busca como texto literal', async () => {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    (
      mockLessonsRepo as unknown as { createQueryBuilder: jest.Mock }
    ).createQueryBuilder = jest.fn().mockReturnValue(qb);

    await repository.findDraftsPaginated({
      search: '100%_certo',
      page: 1,
      limit: 10,
      sort: LessonSortField.UPDATED_AT,
      order: SortOrder.DESC,
    });

    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('ESCAPE'),
      { search: '%100\\%\\_certo%' },
    );
  });

  it('filtra pela semana quando ela é informada, e só então', async () => {
    const build = () => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    });
    const base = {
      page: 1,
      limit: 10,
      sort: LessonSortField.UPDATED_AT,
      order: SortOrder.DESC,
    };
    const withWeek = build();
    (
      mockLessonsRepo as unknown as { createQueryBuilder: jest.Mock }
    ).createQueryBuilder = jest.fn().mockReturnValue(withWeek);

    await repository.findDraftsPaginated({ ...base, weekNumber: 12 });

    expect(withWeek.andWhere).toHaveBeenCalledWith(
      'lesson.weekNumber = :weekNumber',
      { weekNumber: 12 },
    );

    const withoutWeek = build();
    (
      mockLessonsRepo as unknown as { createQueryBuilder: jest.Mock }
    ).createQueryBuilder = jest.fn().mockReturnValue(withoutWeek);

    await repository.findDraftsPaginated(base);

    expect(withoutWeek.andWhere).not.toHaveBeenCalled();
  });

  describe('leases', () => {
    type SetValues = Record<string, unknown>;
    const updateBuilder = (affected: number) => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected }),
      };
      return qb;
    };
    const setValues = (qb: { set: jest.Mock }): SetValues =>
      (qb.set.mock.calls[0] as [SetValues])[0];
    const sql = (value: unknown): string => (value as () => string)();

    it('assume a lease pelo relógio do banco sem incrementar lock_version', async () => {
      const qb = updateBuilder(1);
      (
        mockStagesRepo as unknown as { createQueryBuilder: jest.Mock }
      ).createQueryBuilder = jest.fn().mockReturnValue(qb);

      await expect(
        repository.claimGeneration('stage-1', 'token-1', 30),
      ).resolves.toBe(true);

      const values = setValues(qb);
      expect(values.generationLeaseOwner).toBe('token-1');
      expect(sql(values.generationLeaseUntil)).toBe(
        'DATE_ADD(NOW(), INTERVAL 30 SECOND)',
      );
      // An explicit self-assignment stops TypeORM from adding `+ 1`.
      expect(sql(values.lockVersion)).toBe('lock_version');
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(generation_lease_until IS NULL OR generation_lease_until < NOW())',
      );
    });

    it('renova, libera e grava o request somente para o dono da lease', async () => {
      for (const run of [
        () => repository.renewGenerationLease('stage-1', 'token-1', 30),
        () => repository.releaseGenerationLease('stage-1', 'token-1'),
        () =>
          repository.updateGenerationRequest('stage-1', 'token-1', {
            stage: LessonStageType.LESSON,
            attempts: 1,
          }),
      ]) {
        const lost = updateBuilder(0);
        (
          mockStagesRepo as unknown as { createQueryBuilder: jest.Mock }
        ).createQueryBuilder = jest.fn().mockReturnValue(lost);
        await expect(run()).resolves.toBe(false);
        expect(lost.andWhere).toHaveBeenCalledWith(
          'generation_lease_owner = :owner',
          { owner: 'token-1' },
        );
        expect(sql(setValues(lost).lockVersion)).toBe('lock_version');
      }
    });

    it('normaliza a duração da lease para um inteiro positivo', async () => {
      const qb = updateBuilder(1);
      (
        mockStagesRepo as unknown as { createQueryBuilder: jest.Mock }
      ).createQueryBuilder = jest.fn().mockReturnValue(qb);
      await repository.renewGenerationLease('stage-1', 'token-1', Number.NaN);
      expect(sql(setValues(qb).generationLeaseUntil)).toBe(
        'DATE_ADD(NOW(), INTERVAL 1 SECOND)',
      );
    });
  });

  it('confere referências de assets em outras lições com uma consulta por lote e colunas da entidade', async () => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue({ scanned: '3', match_0: '0', match_1: '1' }),
    };
    (
      mockVersionsRepo as unknown as { createQueryBuilder: jest.Mock }
    ).createQueryBuilder = jest.fn().mockReturnValue(qb);
    const own =
      'https://bucket.s3.amazonaws.com/prod/uploads/1762700000000_ab12cd34_lesson-1-LESSON_VISUALS-kit-01.png';
    const shared =
      'https://bucket.s3.amazonaws.com/prod/uploads/1762700000001_ef56ab78_lesson-1-LESSON_VISUALS-kit-02.png';

    const referenced = await repository.findAssetUrlsReferencedElsewhere(
      'lesson-1',
      [own, shared, own],
    );

    expect([...referenced]).toEqual([shared]);
    expect(qb.getRawOne).toHaveBeenCalledTimes(1);
    expect(qb.where).toHaveBeenCalledWith('stage.lessonId <> :lessonId', {
      lessonId: 'lesson-1',
    });
    const expression = (qb.addSelect.mock.calls[0] as [string])[0];
    // Property paths resolved by TypeORM: never hand-written column names.
    expect(expression).toContain('version.structuredDataJson');
    expect(expression).toContain('version.docxS3Key');
    expect(expression).not.toMatch(/structured_data_json|docx_s3_key/);
    expect(qb.setParameter).toHaveBeenCalledWith(
      'pattern0',
      '%1762700000000\\_ab12cd34\\_lesson-1-LESSON\\_VISUALS-kit-01.png%',
    );
  });

  it('não consulta o banco quando não há assets para conferir', async () => {
    const createQueryBuilder = jest.fn();
    (
      mockVersionsRepo as unknown as { createQueryBuilder: jest.Mock }
    ).createQueryBuilder = createQueryBuilder;
    await expect(
      repository.findAssetUrlsReferencedElsewhere('lesson-1', []),
    ).resolves.toEqual(new Set());
    expect(createQueryBuilder).not.toHaveBeenCalled();
  });
});
