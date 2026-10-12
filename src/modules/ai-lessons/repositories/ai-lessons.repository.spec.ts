import { AiLessonsRepository } from './ai-lessons.repository';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStatus } from '../enums/lesson.enums';
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
      '(LOWER(lesson.theme) LIKE LOWER(:search) OR LOWER(lesson.biblicalReference) LIKE LOWER(:search))',
      { search: '%Páscoa%' },
    );
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
  });
});
