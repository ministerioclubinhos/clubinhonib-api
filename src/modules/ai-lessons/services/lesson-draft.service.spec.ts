import { ConflictException } from '@nestjs/common';
import { LessonDraftService } from './lesson-draft.service';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { LessonEntity } from '../entities/lesson.entity';
import {
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
} from '../enums/lesson.enums';
import { LessonLlmProviderContract } from '../providers/lesson-llm.types';
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
    updateLesson: jest.fn(),
    saveStage: jest.fn(),
    updateStage: jest.fn(),
    findGeneratingStages: jest.fn(),
    claimGeneration: jest.fn(),
    renewGenerationLease: jest.fn(),
  };
  const weekMaterials = { createWeekMaterialsPage: jest.fn() };
  const service = new LessonDraftService(
    repo as unknown as AiLessonsRepository,
    {} as LessonLlmProviderContract,
    {} as AwsS3Service,
    {} as DocxExporterService,
    {} as PdfLibreOfficeService,
    weekMaterials as unknown as WeekMaterialsPageCreateService,
    {} as AdminLessonPromptService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('marca como falha uma geração legada sem dados persistidos para retomada', async () => {
    const stage = {
      status: LessonStageStatus.GENERATING,
      generationRequestJson: null,
      generationRequestedById: null,
      failureCode: null,
      failureMessage: null,
    };
    repo.findGeneratingStages.mockResolvedValue([stage]);

    await service.onApplicationBootstrap();

    expect(stage.status).toBe(LessonStageStatus.FAILED);
    expect(stage.failureCode).toBe('GENERATION_REQUEST_MISSING');
    expect(repo.saveStage).toHaveBeenCalledWith(stage);
  });

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

  it('conclui uma etapa falha sem salvar novamente versões carregadas', async () => {
    const stage = {
      id: 'stage-1',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.FAILED,
      currentVersionId: 'version-1',
      failureCode: 'GENERATION_FAILED',
      failureMessage: "Column 'stage_id' cannot be null",
      versions: [{ id: 'version-1' }],
    };
    const lesson = {
      id: 'lesson-1',
      status: LessonStatus.DRAFT,
      stages: [stage],
    } as unknown as LessonEntity;
    repo.findLessonById.mockResolvedValue(lesson);

    await service.completeProductionStage('lesson-1', LessonStageType.LESSON);

    expect(repo.updateStage).toHaveBeenCalledWith('stage-1', {
      status: LessonStageStatus.PRODUCER_APPROVED,
      approvedAt: null,
      approvedById: null,
      failureCode: null,
      failureMessage: null,
    });
    expect(repo.updateLesson).toHaveBeenCalledWith('lesson-1', {
      status: LessonStatus.PACKAGE_READY,
    });
    expect(repo.saveStage).not.toHaveBeenCalled();
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

  it('mantém a referência bíblica cadastrada como valor canônico', () => {
    const target = service as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const generated = {
      biblicalReference: 'João 3.16',
      memoryVerse: {
        text: 'Porque Deus amou o mundo...',
        reference: 'João 3:16',
        version: 'NVI',
      },
      visualScenes: [{ id: 'scene-01' }],
    };

    const result = target.validateCanonicalContent(
      {
        biblicalReference: 'João 3:16',
      } as LessonEntity,
      LessonStageType.LESSON,
      generated,
    );

    expect(result.biblicalReference).toBe('João 3:16');
  });

  it('aceita a quebra integral da lição decidida pela LLM', () => {
    const target = service as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const story =
      'Começo da história. Desenvolvimento da história. Final da história.';
    const lesson = {
      stages: [
        {
          type: LessonStageType.LESSON,
          currentVersionId: 'version-1',
          versions: [{ id: 'version-1', structuredDataJson: { story } }],
        },
      ],
    } as unknown as LessonEntity;
    const generated = {
      assets: [
        { id: 'visual-01', sourceExcerpt: 'Começo da história.' },
        {
          id: 'visual-02',
          sourceExcerpt: 'Desenvolvimento da história. Final da história.',
        },
      ],
    };

    expect(
      target.validateCanonicalContent(
        lesson,
        LessonStageType.LESSON_VISUALS,
        generated,
      ),
    ).toBe(generated);
  });

  it('rejeita uma quebra que omite parte da lição', () => {
    const target = service as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const lesson = {
      stages: [
        {
          type: LessonStageType.LESSON,
          currentVersionId: 'version-1',
          versions: [
            {
              id: 'version-1',
              structuredDataJson: { story: 'Começo. Parte omitida. Final.' },
            },
          ],
        },
      ],
    } as unknown as LessonEntity;

    expect(() =>
      target.validateCanonicalContent(lesson, LessonStageType.LESSON_VISUALS, {
        assets: [
          { id: 'visual-01', sourceExcerpt: 'Começo.' },
          { id: 'visual-02', sourceExcerpt: 'Final.' },
        ],
      }),
    ).toThrow(ConflictException);
  });

  it('aceita um visual instrucional para cada passo da brincadeira', () => {
    const target = service as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const generated = {
      steps: ['Forme uma roda.', 'Passe a bola para a criança ao lado.'],
      assets: [
        {
          id: 'instrucao-01',
          stepNumber: 1,
          instruction: 'Forme uma roda.',
        },
        {
          id: 'instrucao-02',
          stepNumber: 2,
          instruction: 'Passe a bola para a criança ao lado.',
        },
      ],
    };

    expect(
      target.validateCanonicalContent(
        {} as LessonEntity,
        LessonStageType.STANDARD_GAME,
        generated,
      ),
    ).toBe(generated);
  });

  it('rejeita visual da brincadeira desconectado do passo correspondente', () => {
    const target = service as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };

    expect(() =>
      target.validateCanonicalContent(
        {} as LessonEntity,
        LessonStageType.STANDARD_GAME,
        {
          steps: ['Forme uma roda.'],
          assets: [
            {
              id: 'instrucao-01',
              stepNumber: 1,
              instruction: 'Crianças brincando no pátio.',
            },
          ],
        },
      ),
    ).toThrow(ConflictException);
  });

  it('considera nova somente uma brincadeira com nome, mecânicas e passos diferentes', () => {
    const target = service as unknown as {
      isNewGame: (
        previous: Record<string, unknown>,
        candidate: Record<string, unknown>,
      ) => boolean;
    };
    const previous = {
      name: 'Trilha da alegria',
      funMechanics: ['movimento', 'busca'],
      steps: ['Procure uma pista.', 'Leve a pista ao grupo.'],
    };

    expect(
      target.isNewGame(previous, {
        name: 'Construção cooperativa',
        funMechanics: ['construção', 'ritmo'],
        steps: ['Monte uma torre.', 'Crie um ritmo em grupo.'],
      }),
    ).toBe(true);
    expect(
      target.isNewGame(previous, {
        ...previous,
        name: 'Outro nome para a mesma brincadeira',
      }),
    ).toBe(false);
  });

  it('remove o prefixo scene-01: de citação/blockquote em toTiptap', () => {
    const target = service as unknown as {
      toTiptap: (value: Record<string, unknown>) => {
        content: Array<{
          type: string;
          content?: Array<{
            type: string;
            text?: string;
            content?: Array<{ text: string }>;
          }>;
        }>;
      };
    };

    const tiptap = target.toTiptap({
      story: 'Parágrafo 1\n\nscene-01: Descrição visual da cena 1',
    });

    const blockquotes = tiptap.content.filter(
      (node) => node.type === 'blockquote',
    );
    expect(blockquotes.length).toBe(1);
    const innerText = blockquotes[0].content?.[0]?.content?.[0]?.text;
    expect(innerText).toBe('Descrição visual da cena 1');
  });

  it('preserva o tipo real da imagem ao preparar o upload', () => {
    const target = service as unknown as {
      imageUploadMetadata: (buffer: Buffer) => {
        extension: string;
        mimeType: string;
      };
    };

    expect(
      target.imageUploadMetadata(Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
    ).toEqual({ extension: 'jpg', mimeType: 'image/jpeg' });
    expect(
      target.imageUploadMetadata(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
      ),
    ).toEqual({ extension: 'png', mimeType: 'image/png' });
  });

  it('aceita somente de 4 a 10 visuais da história', () => {
    const target = service as unknown as {
      validateVisualConfig: (dto: {
        visualType: string;
        visualOrientation: string;
        visualQuantity: number;
      }) => unknown;
    };
    const base = {
      visualType: 'STORY_SEQUENCE',
      visualOrientation: 'LANDSCAPE',
    };

    expect(() =>
      target.validateVisualConfig({ ...base, visualQuantity: 3 }),
    ).toThrow();
    expect(() =>
      target.validateVisualConfig({ ...base, visualQuantity: 11 }),
    ).toThrow();
    expect(
      target.validateVisualConfig({ ...base, visualQuantity: 4 }),
    ).toMatchObject({
      quantity: 4,
    });
    expect(
      target.validateVisualConfig({ ...base, visualQuantity: 10 }),
    ).toMatchObject({
      quantity: 10,
    });
  });
});
