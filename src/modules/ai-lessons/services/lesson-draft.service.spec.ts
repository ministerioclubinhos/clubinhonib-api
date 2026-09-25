import { ConflictException } from '@nestjs/common';
import { LessonDraftService } from './lesson-draft.service';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStatus } from '../enums/lesson.enums';
import { OpenAiLessonService } from './open-ai-lesson.service';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { DocxExporterService } from './docx-exporter.service';
import { PdfLibreOfficeService } from './pdf-libreoffice.service';
import { WeekMaterialsPageCreateService } from 'src/modules/pages/week-material-page/services/create-week-material.service';
import { AdminLessonPromptService } from './admin-lesson-prompt.service';

describe('LessonDraftService workflow safety', () => {
  const repo = {
    findLessonById: jest.fn(),
    runInTransaction: jest.fn(),
    findLessonByIdForUpdate: jest.fn(),
    saveLesson: jest.fn(),
  };
  const weekMaterials = { createWeekMaterialsPage: jest.fn() };
  const service = new LessonDraftService(
    repo as unknown as AiLessonsRepository,
    {} as OpenAiLessonService,
    {} as AwsS3Service,
    {} as DocxExporterService,
    {} as PdfLibreOfficeService,
    weekMaterials as unknown as WeekMaterialsPageCreateService,
    {} as AdminLessonPromptService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('GET de detalhe é leitura pura', async () => {
    const lesson = {
      id: 'lesson-1',
      status: LessonStatus.DRAFT,
      stages: [],
    } as unknown as LessonEntity;
    repo.findLessonById.mockResolvedValue(lesson);
    await expect(service.getById('lesson-1')).resolves.toBe(lesson);
    expect(repo.saveLesson).not.toHaveBeenCalled();
  });

  it('retorna o vínculo existente sem criar outro material', async () => {
    const published = {
      id: 'lesson-1',
      status: LessonStatus.PUBLISHED,
      weekMaterialId: 'page-1',
    } as unknown as LessonEntity;
    repo.runInTransaction.mockImplementation(
      async (work: (manager: object) => Promise<unknown>) => work({}),
    );
    repo.findLessonByIdForUpdate.mockResolvedValue(published);
    repo.findLessonById.mockResolvedValue({ ...published, stages: [] });
    const result = await service.publishToWeekMaterial('lesson-1');
    expect(result.weekMaterialId).toBe('page-1');
    expect(weekMaterials.createWeekMaterialsPage).not.toHaveBeenCalled();
  });

  it('rejeita uma segunda publicação enquanto a primeira está em andamento', async () => {
    repo.runInTransaction.mockImplementation(
      async (work: (manager: object) => Promise<unknown>) => work({}),
    );
    repo.findLessonByIdForUpdate.mockResolvedValue({
      id: 'lesson-1',
      status: LessonStatus.PUBLISHING,
    } as unknown as LessonEntity);
    await expect(
      service.publishToWeekMaterial('lesson-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
