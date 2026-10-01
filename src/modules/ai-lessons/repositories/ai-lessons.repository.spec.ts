import { AiLessonsRepository } from './ai-lessons.repository';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { LessonEntity } from '../entities/lesson.entity';

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
      {} as any,
      mockLessonsRepo as any,
      mockStagesRepo as any,
      mockVersionsRepo as any,
      {} as any,
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
});
