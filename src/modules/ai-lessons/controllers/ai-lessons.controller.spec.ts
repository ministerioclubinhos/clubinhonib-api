import { firstValueFrom, take, toArray } from 'rxjs';
import { AuthRequest } from 'src/core/auth/auth.types';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AiLessonsController } from './ai-lessons.controller';
import { LessonDraftService } from '../services/lesson-draft.service';
import { AdminLessonPromptService } from '../services/admin-lesson-prompt.service';
import {
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
} from '../enums/lesson.enums';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import { LessonEventStreamService } from '../services/lesson-event-stream.service';
import { LessonView } from '../enums/lesson-failure-code.enum';
import { LESSON_EVENT_STREAM } from '../constants/lesson-workflow.constants';
import { ErrorCode } from 'src/shared/exceptions';

describe('AiLessonsController', () => {
  const lessonsService = {
    getDashboard: jest.fn(),
    getDrafts: jest.fn(),
    create: jest.fn(),
    getById: jest.fn(),
    generateStage: jest.fn(),
    saveContent: jest.fn(),
    completeProductionStage: jest.fn(),
    submitPackageReview: jest.fn(),
    approveStage: jest.fn(),
    requestChanges: jest.fn(),
    exportPdf: jest.fn(),
    previewStagePdf: jest.fn(),
    publishToWeekMaterial: jest.fn(),
    delete: jest.fn(),
    getEventDigest: jest.fn(),
    reopenStage: jest.fn(),
    archive: jest.fn(),
    unarchive: jest.fn(),
    resolveComment: jest.fn(),
  };
  const req = {
    user: {
      userId: 'admin-1',
      role: 'admin',
      email: 'admin@clubinhonib.com',
    },
  } as AuthRequest;

  const promptsService = {
    list: jest.fn(),
    save: jest.fn(),
    reset: jest.fn(),
  };

  let controller: AiLessonsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AiLessonsController(
      lessonsService as unknown as LessonDraftService,
      promptsService as unknown as AdminLessonPromptService,
      new LessonEventStreamService(
        lessonsService as unknown as LessonDraftService,
      ),
    );
  });

  it('protege o controller com JwtAuthGuard e AdminRoleGuard', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      AiLessonsController,
    ) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, AdminRoleGuard]);
  });

  it('encaminha lockVersion em resetPrompt, completeProduction, approve, requestChanges e previewStage', async () => {
    const sampleLesson = Object.assign(new LessonEntity(), {
      id: 'lesson-1',
      weekNumber: 3,
      theme: 'Amor de Deus',
      biblicalReference: 'João 3:16',
      status: LessonStatus.IN_REVIEW,
      stages: [],
      comments: [],
    });

    promptsService.reset.mockResolvedValue({
      stage: LessonStageType.LESSON,
      basePrompt: 'Base',
      customPrompt: null,
      effectivePrompt: 'Base',
      lockVersion: 4,
    });
    lessonsService.completeProductionStage.mockResolvedValue(sampleLesson);
    lessonsService.approveStage.mockResolvedValue(sampleLesson);
    lessonsService.requestChanges.mockResolvedValue(sampleLesson);
    lessonsService.previewStagePdf.mockResolvedValue({
      pdfBuffer: Buffer.from('%PDF-1.4'),
      fileName: 'preview-lesson-semana-3.pdf',
    });

    await controller.resetPrompt(
      { stage: LessonStageType.LESSON, lockVersion: 3 },
      req,
    );
    expect(promptsService.reset).toHaveBeenCalledWith(
      'admin-1',
      LessonStageType.LESSON,
      3,
      undefined,
    );

    await controller.completeProduction(
      'lesson-1',
      { stage: LessonStageType.LESSON, lockVersion: 5, acknowledgeStale: true },
      req,
    );
    expect(lessonsService.completeProductionStage).toHaveBeenCalledWith(
      'lesson-1',
      LessonStageType.LESSON,
      5,
      { acknowledgeStale: true, actorId: 'admin-1' },
    );

    await controller.approve(
      'lesson-1',
      { stage: LessonStageType.LESSON, lockVersion: 6 },
      req,
    );
    expect(lessonsService.approveStage).toHaveBeenCalledWith(
      'lesson-1',
      LessonStageType.LESSON,
      'admin-1',
      6,
    );

    await controller.requestChanges(
      'lesson-1',
      {
        stage: LessonStageType.LESSON,
        note: 'Corrigir conclusão',
        lockVersion: 7,
      },
      req,
    );
    expect(lessonsService.requestChanges).toHaveBeenCalledWith(
      'lesson-1',
      LessonStageType.LESSON,
      'Corrigir conclusão',
      'admin-1',
      7,
    );

    const streamable = await controller.previewStage(
      'lesson-1',
      LessonStageType.LESSON,
      { lockVersion: 7, versionId: 'ver-7' },
    );
    expect(lessonsService.previewStagePdf).toHaveBeenCalledWith(
      'lesson-1',
      LessonStageType.LESSON,
      7,
      'ver-7',
    );
    expect(streamable.getHeaders().type).toBe('application/pdf');
  });

  it('suporta view=compact em GET :id mantendo apenas a versão atual de cada etapa', async () => {
    const lesson = Object.assign(new LessonEntity(), {
      id: 'lesson-compact',
      weekNumber: 2,
      theme: 'Fé',
      biblicalReference: 'Hebreus 11:1',
      status: LessonStatus.IN_PROGRESS,
      stages: [
        Object.assign(new LessonStageEntity(), {
          id: 'stage-1',
          type: LessonStageType.LESSON,
          status: LessonStageStatus.DRAFT,
          lockVersion: 2,
          currentVersionId: 'v-2',
          versions: [
            Object.assign(new LessonVersionEntity(), {
              id: 'v-1',
              versionNumber: 1,
              structuredDataJson: { story: 'Antiga' },
            }),
            Object.assign(new LessonVersionEntity(), {
              id: 'v-2',
              versionNumber: 2,
              structuredDataJson: { story: 'Atual' },
            }),
          ],
        }),
      ],
      comments: [],
    });
    lessonsService.getById.mockResolvedValue(lesson);

    const fullResponse = await controller.get('lesson-compact');
    expect(fullResponse.stages[0].versions).toHaveLength(2);

    const compactResponse = await controller.get('lesson-compact', {
      view: LessonView.COMPACT,
    });
    expect(compactResponse.stages[0].versions).toHaveLength(1);
    expect(compactResponse.stages[0].versions[0].id).toBe('v-2');
  });

  it('emite snapshot inicial seguido de heartbeat quando o digest permanece inalterado no SSE', async () => {
    jest.useFakeTimers();
    try {
      const lesson = Object.assign(new LessonEntity(), {
        id: 'lesson-sse',
        weekNumber: 4,
        theme: 'Esperança',
        biblicalReference: 'Romanos 5:5',
        status: LessonStatus.IN_PROGRESS,
        stages: [
          Object.assign(new LessonStageEntity(), {
            id: 'stage-1',
            type: LessonStageType.LESSON,
            status: LessonStageStatus.GENERATING,
            lockVersion: 1,
            currentVersionId: null,
            versions: [],
          }),
        ],
        comments: [],
      });
      lessonsService.getById.mockResolvedValue(lesson);
      lessonsService.getEventDigest.mockResolvedValue('digest-1');

      const stream$ = controller.events('lesson-sse', req, {
        view: LessonView.COMPACT,
      });
      const collectedPromise = firstValueFrom(stream$.pipe(take(2), toArray()));

      await jest.advanceTimersByTimeAsync(2100);
      const events = await collectedPromise;

      expect(events).toHaveLength(2);
      expect(events[0].data).toMatchObject({ id: 'lesson-sse' });
      expect(events[1]).toMatchObject({
        type: 'heartbeat',
        data: { type: 'heartbeat' },
      });
      // The graph is loaded once; the unchanged tick costs only the digest.
      expect(lessonsService.getById).toHaveBeenCalledTimes(1);
      expect(lessonsService.getEventDigest).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('recusa novas conexões SSE acima do limite por usuário e lição e libera a vaga ao desconectar', async () => {
    lessonsService.getEventDigest.mockResolvedValue('digest-1');
    lessonsService.getById.mockResolvedValue(
      Object.assign(new LessonEntity(), {
        id: 'lesson-cap',
        status: LessonStatus.IN_PROGRESS,
        stages: [],
        comments: [],
      }),
    );
    const open = () =>
      controller
        .events('lesson-cap', req)
        .subscribe({ error: () => undefined });
    const subscriptions = Array.from(
      { length: LESSON_EVENT_STREAM.MAX_CONNECTIONS_PER_USER_AND_LESSON },
      open,
    );
    await expect(
      firstValueFrom(controller.events('lesson-cap', req)),
    ).rejects.toMatchObject({ code: ErrorCode.LESSON_EVENT_STREAM_LIMIT });

    subscriptions[0].unsubscribe();
    await expect(
      firstValueFrom(controller.events('lesson-cap', req)),
    ).resolves.toMatchObject({ data: { id: 'lesson-cap' } });
    subscriptions.forEach((subscription) => subscription.unsubscribe());
  });

  it('encaminha o ator e os dados de reabrir, arquivar, publicar e excluir', async () => {
    const lesson = Object.assign(new LessonEntity(), {
      id: 'lesson-2',
      status: LessonStatus.PUBLISHED,
      stages: [],
      comments: [],
    });
    lessonsService.reopenStage.mockResolvedValue(lesson);
    lessonsService.archive.mockResolvedValue(lesson);
    lessonsService.unarchive.mockResolvedValue(lesson);
    lessonsService.resolveComment.mockResolvedValue(lesson);
    lessonsService.submitPackageReview.mockResolvedValue(lesson);
    lessonsService.publishToWeekMaterial.mockResolvedValue({
      lesson,
      weekMaterialId: 'page-1',
    });
    lessonsService.delete.mockResolvedValue({ success: true, message: 'ok' });

    await controller.reopen(
      'lesson-2',
      {
        stage: LessonStageType.LESSON,
        note: 'Erro no versículo',
        lockVersion: 9,
      },
      req,
    );
    expect(lessonsService.reopenStage).toHaveBeenCalledWith(
      'lesson-2',
      LessonStageType.LESSON,
      'Erro no versículo',
      'admin-1',
      9,
    );
    await controller.archive('lesson-2', req);
    expect(lessonsService.archive).toHaveBeenCalledWith('lesson-2', 'admin-1');
    await controller.unarchive('lesson-2', req);
    expect(lessonsService.unarchive).toHaveBeenCalledWith(
      'lesson-2',
      'admin-1',
    );
    await controller.resolveComment('lesson-2', 'comment-1', req);
    expect(lessonsService.resolveComment).toHaveBeenCalledWith(
      'lesson-2',
      'comment-1',
      'admin-1',
    );
    await controller.submitPackage('lesson-2', req);
    expect(lessonsService.submitPackageReview).toHaveBeenCalledWith(
      'lesson-2',
      'admin-1',
    );
    await expect(controller.publish('lesson-2', req)).resolves.toMatchObject({
      weekMaterialId: 'page-1',
    });
    expect(lessonsService.publishToWeekMaterial).toHaveBeenCalledWith(
      'lesson-2',
      'admin-1',
    );
    await controller.delete('lesson-2', req);
    expect(lessonsService.delete).toHaveBeenCalledWith('lesson-2', 'admin-1');
  });
});
