import 'reflect-metadata';

import {
  LESSON_DASHBOARD_ACTIVE_LIMIT,
  LESSON_DASHBOARD_FINISHED_STATUSES,
  LESSON_DASHBOARD_RECENT_LIMIT,
} from '../constants/lesson-repository.constants';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStatus } from '../enums/lesson.enums';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { GetLessonService } from './get-lesson.service';

describe('GetLessonService.getDashboard', () => {
  const lesson = (id: string, status: LessonStatus) =>
    ({ id, status, stages: [] }) as unknown as LessonEntity;

  const repo = {
    getDashboardStatusCounts: jest.fn(),
    findLessonsOutsideStatuses: jest.fn(),
    findRecentLessons: jest.fn(),
  };
  const service = new GetLessonService(repo as unknown as AiLessonsRepository);

  beforeEach(() => {
    jest.clearAllMocks();
    repo.getDashboardStatusCounts.mockResolvedValue([
      { status: LessonStatus.IN_PROGRESS, count: '3' },
      { status: LessonStatus.PUBLISHED, count: '2' },
    ]);
    repo.findLessonsOutsideStatuses.mockResolvedValue([
      lesson('a', LessonStatus.IN_PROGRESS),
    ]);
    repo.findRecentLessons.mockResolvedValue([
      lesson('b', LessonStatus.PUBLISHED),
    ]);
  });

  it('counts every status, including the ones with no lesson', async () => {
    const dashboard = await service.getDashboard();

    expect(dashboard.total).toBe(5);
    expect(dashboard.byStatus[LessonStatus.IN_PROGRESS]).toBe(3);
    expect(dashboard.byStatus[LessonStatus.CHANGES_REQUESTED]).toBe(0);
  });

  it('lists the lessons still in the works as the work queue', async () => {
    const dashboard = await service.getDashboard();

    expect(repo.findLessonsOutsideStatuses).toHaveBeenCalledWith(
      LESSON_DASHBOARD_FINISHED_STATUSES,
      LESSON_DASHBOARD_ACTIVE_LIMIT,
    );
    expect(dashboard.active.map((item) => item.id)).toEqual(['a']);
  });

  it('keeps published and archived lessons out of the work queue', () => {
    expect(LESSON_DASHBOARD_FINISHED_STATUSES).toEqual([
      LessonStatus.PUBLISHED,
      LessonStatus.ARCHIVED,
    ]);
  });

  it('still returns the most recently touched lessons of any status', async () => {
    const dashboard = await service.getDashboard();

    expect(repo.findRecentLessons).toHaveBeenCalledWith(
      LESSON_DASHBOARD_RECENT_LIMIT,
    );
    expect(dashboard.recent.map((item) => item.id)).toEqual(['b']);
  });
});
