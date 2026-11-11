import { LessonEntity } from '../entities/lesson.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { LessonStatus } from '../enums/lesson.enums';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import type { LessonEventDigestSource } from '../types/lesson-generation.types';

/**
 * One jest mock per public repository method. Keyed by the repository type, so
 * a method added to the repository must be added here to compile.
 */
export type LessonsRepositoryMock = Record<
  keyof AiLessonsRepository,
  jest.Mock
>;

type TransactionWork = (manager: object) => Promise<unknown>;
type Patch = Record<string, unknown>;

/**
 * Typed stand-in for `AiLessonsRepository`. It behaves like a tiny in-memory
 * store over the lesson last returned by `findLessonById`: partial updates are
 * applied to that object, so specs observe the same state the service wrote.
 * Tests override single methods; nothing in production code may depend on a
 * method being absent.
 */
export function createLessonsRepositoryMock(): LessonsRepositoryMock {
  const mock: LessonsRepositoryMock = {
    runInTransaction: jest.fn(),
    createLesson: jest.fn(),
    saveLesson: jest.fn(),
    updateLesson: jest.fn(),
    findLessonByIdForUpdate: jest.fn(),
    findLessonById: jest.fn(),
    findLessonHeader: jest.fn(),
    findLessonDigestSource: jest.fn(),
    findDraftsPaginated: jest.fn(),
    getDashboardStatusCounts: jest.fn(),
    findRecentLessons: jest.fn(),
    removeLesson: jest.fn(),
    createStage: jest.fn(),
    saveStage: jest.fn(),
    updateStage: jest.fn(),
    saveStages: jest.fn(),
    findStageById: jest.fn(),
    findGeneratingStages: jest.fn(),
    claimGeneration: jest.fn(),
    renewGenerationLease: jest.fn(),
    releaseGenerationLease: jest.fn(),
    updateGenerationRequest: jest.fn(),
    findExpiredPublishingLessons: jest.fn(),
    isPublicationLeaseActive: jest.fn(),
    reservePublication: jest.fn(),
    renewPublicationLease: jest.fn(),
    findAssetUrlsReferencedElsewhere: jest.fn(),
    findVersionById: jest.fn(),
    findVersionCreationDates: jest.fn(),
    createVersion: jest.fn(),
    saveVersion: jest.fn(),
    createComment: jest.fn(),
    saveComment: jest.fn(),
    resolveComment: jest.fn(),
  } satisfies LessonsRepositoryMock;
  resetLessonsRepositoryMock(mock);
  return mock;
}

/** Lessons most recently returned by the full and by the locking read. */
async function loadedLessons(
  mock: LessonsRepositoryMock,
): Promise<LessonEntity[]> {
  const lessons: LessonEntity[] = [];
  for (const read of [mock.findLessonById, mock.findLessonByIdForUpdate]) {
    const last = read.mock.results.at(-1);
    if (last?.type !== 'return') continue;
    const lesson = (await last.value) as LessonEntity | null | undefined;
    if (lesson && !lessons.includes(lesson)) lessons.push(lesson);
  }
  return lessons;
}

/** Restores the default behaviors (call it after `jest.clearAllMocks()`). */
export function resetLessonsRepositoryMock(mock: LessonsRepositoryMock): void {
  for (const method of Object.values(mock)) method.mockReset();
  mock.runInTransaction.mockImplementation((work: TransactionWork) => work({}));
  mock.findLessonByIdForUpdate.mockImplementation(
    (id: string) => mock.findLessonById(id) as Promise<LessonEntity | null>,
  );
  mock.findLessonHeader.mockImplementation(
    (id: string) => mock.findLessonById(id) as Promise<LessonEntity | null>,
  );
  mock.findLessonDigestSource.mockImplementation(async (id: string) => {
    const lesson = (await mock.findLessonById(id)) as LessonEntity | null;
    if (!lesson) return null;
    const source: LessonEventDigestSource = {
      id: lesson.id,
      status: lesson.status,
      weekMaterialId: lesson.weekMaterialId ?? null,
      publicationFailureMessage: lesson.publicationFailureMessage ?? null,
      stages: (lesson.stages ?? []).map((stage) => ({
        type: stage.type,
        status: stage.status,
        lockVersion: stage.lockVersion ?? 0,
        currentVersionId: stage.currentVersionId ?? null,
        failureCode: stage.failureCode ?? null,
        failureMessage: stage.failureMessage ?? null,
      })),
      commentCount: (lesson.comments ?? []).length,
    };
    return source;
  });
  mock.updateLesson.mockImplementation(
    async (lessonId: string, data: Patch) => {
      for (const lesson of await loadedLessons(mock))
        if (lesson.id === undefined || lesson.id === lessonId)
          Object.assign(lesson, data);
    },
  );
  mock.updateStage.mockImplementation(async (stageId: string, data: Patch) => {
    for (const lesson of await loadedLessons(mock)) {
      const stage = lesson.stages?.find((item) => item.id === stageId);
      if (stage) Object.assign(stage, data);
    }
  });
  mock.reservePublication.mockImplementation(
    async (
      lessonId: string,
      owner: string,
      _leaseSeconds: number,
      reservedVersions: Record<string, string>,
    ) => {
      for (const lesson of await loadedLessons(mock))
        if (lesson.id === undefined || lesson.id === lessonId)
          Object.assign(lesson, {
            status: LessonStatus.PUBLISHING,
            publicationLeaseOwner: owner,
            publicationReservedVersionsJson: reservedVersions,
            publicationFailureMessage: null,
          });
    },
  );
  mock.findVersionById.mockImplementation(async (versionId: string) => {
    for (const lesson of await loadedLessons(mock))
      for (const stage of lesson.stages ?? []) {
        const version = (stage.versions ?? []).find(
          (item) => item.id === versionId,
        );
        if (version)
          return Object.assign(new LessonVersionEntity(), version, {
            stageId: version.stageId ?? stage.id,
          });
      }
    return null;
  });
  mock.findVersionCreationDates.mockImplementation(
    async (versionIds: string[]) => {
      const dates = new Map<string, Date>();
      for (const lesson of await loadedLessons(mock))
        for (const stage of lesson.stages ?? [])
          for (const version of stage.versions ?? [])
            if (versionIds.includes(version.id) && version.createdAt)
              dates.set(version.id, version.createdAt);
      return dates;
    },
  );
  mock.findStageById.mockResolvedValue(null);
  mock.findGeneratingStages.mockResolvedValue([]);
  mock.claimGeneration.mockResolvedValue(true);
  mock.renewGenerationLease.mockResolvedValue(true);
  mock.releaseGenerationLease.mockResolvedValue(true);
  mock.updateGenerationRequest.mockResolvedValue(true);
  mock.findExpiredPublishingLessons.mockResolvedValue([]);
  mock.isPublicationLeaseActive.mockResolvedValue(false);
  mock.renewPublicationLease.mockResolvedValue(true);
  mock.findAssetUrlsReferencedElsewhere.mockResolvedValue(new Set<string>());
  mock.resolveComment.mockResolvedValue(true);
  mock.createLesson.mockImplementation((data: unknown) => data);
  mock.createStage.mockImplementation((data: unknown) => data);
  mock.createVersion.mockImplementation((data: unknown) => data);
  mock.createComment.mockImplementation((data: unknown) => data);
  mock.saveVersion.mockImplementation((version: unknown) =>
    Promise.resolve(version),
  );
  mock.saveLesson.mockImplementation((lesson: unknown) =>
    Promise.resolve(lesson),
  );
  mock.saveStage.mockImplementation((stage: unknown) => Promise.resolve(stage));
  mock.saveStages.mockImplementation((stages: unknown) =>
    Promise.resolve(stages),
  );
  mock.saveComment.mockImplementation((comment: unknown) =>
    Promise.resolve(comment),
  );
}
