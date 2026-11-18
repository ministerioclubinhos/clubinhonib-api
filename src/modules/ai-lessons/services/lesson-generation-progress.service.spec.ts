import { LessonGenerationPhase } from '../enums/lesson-generation-phase.enum';
import { LessonStageStatus, LessonStageType } from '../enums/lesson.enums';
import { LessonEntity } from '../entities/lesson.entity';
import { MemoryLessonProgressStore } from '../testing/memory-lesson-progress.store';
import {
  generationOfLesson,
  generationPercent,
  generationProgressDigest,
  parseGenerationProgress,
} from '../utils/lesson-generation-progress.utils';
import { LessonGenerationProgressService } from './lesson-generation-progress.service';

const START = {
  lessonId: 'lesson-1',
  theme: 'A ovelha perdida',
  stage: LessonStageType.LESSON_VISUALS,
  requestedById: 'admin-1',
  expectedImages: 5,
};

describe('LessonGenerationProgressService', () => {
  let store: MemoryLessonProgressStore;
  let service: LessonGenerationProgressService;

  beforeEach(() => {
    store = new MemoryLessonProgressStore();
    service = new LessonGenerationProgressService(store);
  });

  it('abre o registro na fase de texto com as imagens pedidas', async () => {
    await service.begin(START);

    expect(await service.get('lesson-1')).toMatchObject({
      phase: LessonGenerationPhase.WRITING,
      totalImages: 5,
      completedImages: 0,
      theme: 'A ovelha perdida',
    });
  });

  it('a retomada da mesma etapa mantém o início e o que já foi feito', async () => {
    await service.begin(START);
    await service.advance('lesson-1', {
      phase: LessonGenerationPhase.IMAGES,
      completedImages: 2,
    });
    const before = await service.get('lesson-1');

    await service.begin(START);

    expect(await service.get('lesson-1')).toEqual(before);
  });

  it('um pedido novo reinicia o registro', async () => {
    await service.begin(START);
    await service.advance('lesson-1', {
      phase: LessonGenerationPhase.IMAGES,
      completedImages: 2,
    });

    await service.begin({ ...START, reset: true });

    expect(await service.get('lesson-1')).toMatchObject({
      phase: LessonGenerationPhase.WRITING,
      completedImages: 0,
    });
  });

  it('não recria um registro encerrado ao avançar', async () => {
    await service.begin(START);
    await service.finish('lesson-1');

    await service.advance('lesson-1', { completedImages: 3 });

    expect(await service.get('lesson-1')).toBeNull();
    expect(await service.listActive()).toEqual([]);
  });

  it('lista as gerações em andamento e ignora registros corrompidos', async () => {
    await service.begin(START);
    store.records.set('lesson-2', '{quebrado');

    const active = await service.listActive();

    expect(active.map((item) => item.lessonId)).toEqual(['lesson-1']);
  });

  it('nunca propaga a falha do armazenamento', async () => {
    store.failure = new Error('redis fora do ar');

    await expect(service.begin(START)).resolves.toBeUndefined();
    await expect(service.advance('lesson-1', {})).resolves.toBeUndefined();
    await expect(service.touch('lesson-1')).resolves.toBeUndefined();
    await expect(service.finish('lesson-1')).resolves.toBeUndefined();
    expect(await service.get('lesson-1')).toBeNull();
    expect(await service.listActive()).toEqual([]);
  });
});

describe('progresso de geração — utils', () => {
  const progress = (
    phase: LessonGenerationPhase,
    completedImages: number,
    totalImages = 5,
  ) => ({ phase, completedImages, totalImages });

  it('conta o texto como um passo e cada imagem como outro', () => {
    expect(generationPercent(progress(LessonGenerationPhase.WRITING, 0))).toBe(
      0,
    );
    expect(generationPercent(progress(LessonGenerationPhase.IMAGES, 0))).toBe(
      17,
    );
    expect(generationPercent(progress(LessonGenerationPhase.IMAGES, 2))).toBe(
      50,
    );
  });

  it('nunca chega a 100% antes de gravar', () => {
    expect(generationPercent(progress(LessonGenerationPhase.SAVING, 5))).toBe(
      99,
    );
  });

  it('não inventa porcentagem para etapa sem imagens', () => {
    expect(
      generationPercent(progress(LessonGenerationPhase.WRITING, 0, 0)),
    ).toBeNull();
  });

  it('muda a impressão digital a cada imagem', () => {
    const base = {
      ...START,
      startedAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
      totalImages: 5,
    };
    const one = generationProgressDigest({
      ...base,
      phase: LessonGenerationPhase.IMAGES,
      completedImages: 1,
    });
    const two = generationProgressDigest({
      ...base,
      phase: LessonGenerationPhase.IMAGES,
      completedImages: 2,
    });
    expect(one).not.toBe(two);
    expect(generationProgressDigest(null)).toBe('');
  });

  it('rejeita registros com etapa, fase ou contagem inválidas', () => {
    const valid = {
      ...START,
      phase: LessonGenerationPhase.IMAGES,
      totalImages: 5,
      completedImages: 9,
      startedAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };
    expect(
      parseGenerationProgress(JSON.stringify(valid))?.completedImages,
    ).toBe(5);
    expect(
      parseGenerationProgress(JSON.stringify({ ...valid, phase: 'X' })),
    ).toBeNull();
    expect(
      parseGenerationProgress(JSON.stringify({ ...valid, totalImages: -1 })),
    ).toBeNull();
    expect(parseGenerationProgress(null)).toBeNull();
  });

  it('só devolve o progresso se o banco confirma que a etapa está gerando', () => {
    const record = {
      ...START,
      phase: LessonGenerationPhase.IMAGES,
      totalImages: 5,
      completedImages: 1,
      startedAt: '2026-11-12T00:00:00.000Z',
      updatedAt: '2026-11-12T00:00:00.000Z',
    };
    const lesson = (status: LessonStageStatus) =>
      Object.assign(new LessonEntity(), {
        id: 'lesson-1',
        stages: [{ type: LessonStageType.LESSON_VISUALS, status }],
      });

    expect(
      generationOfLesson(lesson(LessonStageStatus.GENERATING), record),
    ).toBe(record);
    expect(
      generationOfLesson(lesson(LessonStageStatus.DRAFT), record),
    ).toBeNull();
  });
});
