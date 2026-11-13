import { LessonImagePurpose } from '../providers/lesson-llm.types';
import type {
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
} from '../providers/lesson-llm.types';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';
import { ConflictException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { getMetadataArgsStorage } from 'typeorm';
import { createLessonStudio } from '../testing/lesson-studio.factory';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonStageEntity } from '../entities/lesson-stage.entity';
import { LessonVersionEntity } from '../entities/lesson-version.entity';
import {
  olderMeditationFixture,
  OLDER_MEDITATION_SOURCE,
} from '../fixtures/older-meditation.fixture';
import {
  LESSON_STAGE_ORDER,
  LessonStageStatus,
  LessonStageType,
  LessonStatus,
} from '../enums/lesson.enums';
import { LessonLlmProviderContract } from '../providers/lesson-llm.types';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { DocxExporterService } from './docx-exporter.service';
import { PdfLibreOfficeService } from './pdf-libreoffice.service';
import { WeekMaterialsPageCreateService } from 'src/modules/pages/week-material-page/services/create-week-material.service';
import { WeekMaterialsPageGetService } from 'src/modules/pages/week-material-page/services/get-week-material.service';
import { AdminLessonPromptService } from './admin-lesson-prompt.service';
import { ConfigService } from '@nestjs/config';
import { AppConflictException } from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import {
  createLessonsRepositoryMock,
  resetLessonsRepositoryMock,
} from '../testing/lessons-repository.mock';
import { describeAiFailure } from '../utils/lesson-ai-failure.utils';
import { LESSON_GENERATION } from '../constants/lesson-workflow.constants';
import {
  isNewGame,
  isNewGameFromHistory,
  validateCanonicalContent,
  validateVisualConfig,
} from '../utils/lesson-generation-validation.utils';
import { lessonContentToTiptap } from '../utils/lesson-tiptap.utils';
import { lessonUploadImageMetadata } from '../utils/lesson-upload-image.utils';
import {
  canonicalizeVerseVisualAssets,
  lockDerivedVerse,
} from '../utils/lesson-verse.utils';

/** Fixtures of the older specs carry no lock version; neither does the call. */
const UNVERSIONED = undefined as unknown as number;

describe('LessonDraftService workflow safety', () => {
  const pureLessonUtils = {
    describeAiFailure,
    toTiptap: lessonContentToTiptap,
    validateCanonicalContent,
    isNewGame,
    isNewGameFromHistory,
    canonicalizeVerseVisualAssets,
    lockDerivedVerse,
    imageUploadMetadata: lessonUploadImageMetadata,
    validateVisualConfig,
  };
  const repo = createLessonsRepositoryMock();
  const weekMaterials = { createWeekMaterialsPage: jest.fn() };
  const weekMaterialsGet = {
    findAllPaginated: jest.fn(),
    findOneBySourceLessonId: jest.fn(),
    findOnePage: jest.fn(),
  };
  const config = {
    get: jest.fn((key: string) => process.env[key]),
  } as unknown as ConfigService;
  const mediaMock = {
    discardUnreferencedUploads: jest.fn(),
  };
  const media = mediaMock as unknown as MediaItemProcessor;
  const studio = createLessonStudio(
    repo as unknown as AiLessonsRepository,
    {} as LessonLlmProviderContract,
    {} as AwsS3Service,
    {} as DocxExporterService,
    {} as PdfLibreOfficeService,
    weekMaterials as unknown as WeekMaterialsPageCreateService,
    weekMaterialsGet as unknown as WeekMaterialsPageGetService,
    {} as AdminLessonPromptService,
    config,
    media,
  );
  const service = studio.service;

  beforeEach(() => {
    jest.clearAllMocks();
    resetLessonsRepositoryMock(repo);
    weekMaterialsGet.findAllPaginated.mockResolvedValue({ data: [], total: 0 });
    weekMaterialsGet.findOneBySourceLessonId.mockResolvedValue(null);
    weekMaterialsGet.findOnePage.mockImplementation((id: string) =>
      Promise.resolve({ id }),
    );
    mediaMock.discardUnreferencedUploads.mockImplementation(
      async (urls: string[], deleteFn: (url: string) => Promise<void>) => {
        for (const url of urls) await deleteFn(url);
        return urls.length;
      },
    );
  });

  it('corrects omitted, rewritten and repeated story excerpts before accepting visuals', async () => {
    const story = '### Início\nComeço. Parte central. Final.';
    const lesson = {
      stages: [
        {
          type: LessonStageType.LESSON,
          currentVersionId: 'approved',
          versions: [{ id: 'approved', structuredDataJson: { story } }],
        },
      ],
    } as unknown as LessonEntity;
    const valid = {
      responseId: 'corrected',
      content: {
        assets: [
          { id: 'visual-01', sourceExcerpt: '### Início\nComeço.' },
          { id: 'visual-02', sourceExcerpt: 'Parte central. Final.' },
        ],
      },
    };
    const generateStage = jest.fn<
      Promise<LessonLlmGenerationResult>,
      [LessonLlmGenerationInput]
    >();
    const instance = createLessonStudio(
      repo as unknown as AiLessonsRepository,
      { generateStage } as unknown as LessonLlmProviderContract,
      {} as AwsS3Service,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      weekMaterialsGet as unknown as WeekMaterialsPageGetService,
      {} as AdminLessonPromptService,
      config,
      media,
    );
    const target = instance.generation as unknown as {
      correctStoryVisuals: (
        lesson: LessonEntity,
        input: LessonLlmGenerationInput,
        generated: LessonLlmGenerationResult,
        provider: LessonLlmProviderContract,
      ) => Promise<LessonLlmGenerationResult>;
    };
    const provider = { generateStage } as unknown as LessonLlmProviderContract;
    const input: LessonLlmGenerationInput = {
      stage: LessonStageType.LESSON_VISUALS,
      theme: 'Tema',
      biblicalReference: 'Lucas 15:11-32',
      weekNumber: 16,
      template: LESSON_TEMPLATES[LessonStageType.LESSON_VISUALS],
      approvedUpstream: { story },
      adminPrompt: '',
      revisionInstructions: 'Preserve o estilo.',
      visualConfig: { quantity: 2, type: 'color', orientation: 'portrait' },
    };
    for (const excerpt of [
      'Começo. Final.',
      'Começo reescrito. Parte central. Final.',
      `${story} Final.`,
    ]) {
      generateStage.mockClear().mockResolvedValue(valid);
      const invalid = {
        responseId: 'invalid',
        content: {
          assets: [{ id: 'visual-01', sourceExcerpt: excerpt }],
        },
      };
      await expect(
        target.correctStoryVisuals(lesson, input, invalid, provider),
      ).resolves.toEqual(valid);
      expect(generateStage).toHaveBeenCalledTimes(1);
      expect(generateStage.mock.calls[0][0].revisionInstructions).toContain(
        story,
      );
      expect(generateStage.mock.calls[0][0].revisionInstructions).toContain(
        JSON.stringify(invalid.content),
      );
      expect(generateStage.mock.calls[0][0].revisionInstructions).toContain(
        'Preserve o estilo.',
      );
    }
    generateStage.mockClear();
    await expect(
      target.correctStoryVisuals(lesson, input, valid, provider),
    ).resolves.toBe(valid);
    expect(generateStage).not.toHaveBeenCalled();

    const wrongQuantity = {
      responseId: 'one',
      content: {
        assets: [{ id: 'visual-01', sourceExcerpt: story }],
      },
    };
    generateStage.mockResolvedValue(wrongQuantity);
    await expect(
      target.correctStoryVisuals(lesson, input, wrongQuantity, provider),
    ).rejects.toThrow('exatamente 2');
    expect(generateStage).toHaveBeenCalledTimes(2);

    generateStage
      .mockClear()
      .mockRejectedValue(new Error('Provider unavailable'));
    await expect(
      target.correctStoryVisuals(lesson, input, wrongQuantity, provider),
    ).rejects.toThrow('Provider unavailable');
    expect(generateStage).toHaveBeenCalledTimes(1);
    generateStage.mockClear();
    await expect(
      target.correctStoryVisuals(
        { stages: [] } as unknown as LessonEntity,
        input,
        valid,
        provider,
      ),
    ).rejects.toThrow('narrativa completa');
    expect(generateStage).not.toHaveBeenCalled();
  });

  it('sends an uncolored manual-work image prompt and coloring purpose to the provider', async () => {
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=',
      'base64',
    );
    const generateImage = jest.fn().mockResolvedValue(png);
    const target = createLessonStudio(
      repo as unknown as AiLessonsRepository,
      { generateImage } as unknown as LessonLlmProviderContract,
      {
        upload: jest.fn().mockResolvedValue('https://example.test/manual.png'),
      } as unknown as AwsS3Service,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      weekMaterialsGet as unknown as WeekMaterialsPageGetService,
      {} as AdminLessonPromptService,
      config,
      media,
    ).assets as unknown as {
      generateAndStoreAssets: (
        id: string,
        type: LessonStageType,
        lesson: LessonEntity,
        content: Record<string, unknown>,
        uploaded: string[],
        prepared: undefined,
        provider: LessonLlmProviderContract,
      ) => Promise<Record<string, unknown>>;
    };
    await target.generateAndStoreAssets(
      'lesson',
      LessonStageType.MANUAL_WORK,
      { stages: [] } as unknown as LessonEntity,
      {
        printableAssets: [
          { id: 'manual', prompt: 'Cena com céu azul e roupas vermelhas.' },
        ],
      },
      [],
      undefined,
      { generateImage } as unknown as LessonLlmProviderContract,
    );
    expect(generateImage).toHaveBeenCalledTimes(1);
    expect(generateImage).toHaveBeenCalledWith(
      expect.stringContaining('Não use cores, tons de cinza'),
      '',
      '',
      undefined,
      LessonImagePurpose.MANUAL_COLORING,
    );
  });
  it('allows older text-only meditation while preserving the approved verse and other asset requirements', () => {
    const target = pureLessonUtils as unknown as {
      lockDerivedVerse: (
        lesson: LessonEntity,
        type: LessonStageType,
        content: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const lesson = {
      stages: [
        {
          type: LessonStageType.LESSON,
          currentVersionId: 'approved-verse',
          versions: [
            {
              id: 'approved-verse',
              structuredDataJson: {
                memoryVerse: {
                  text: 'Eu sou a ressurreição e a vida.',
                  reference: 'João 11:25',
                  version: 'NVI',
                },
              },
            },
          ],
        },
      ],
    } as unknown as LessonEntity;
    const content = {
      printableAssets: [],
      activities: [{ instruction: 'Complete as frases.' }],
    };
    expect(
      target.lockDerivedVerse(
        lesson,
        LessonStageType.MEDITATION_OLDER,
        content,
      ),
    ).toMatchObject({
      printableAssets: [],
      verseText: 'Eu sou a ressurreição e a vida.',
      verseReference: 'João 11:25',
      verseVersion: 'NVI',
      activities: content.activities,
    });
    for (const type of [
      LessonStageType.MEDITATION_YOUNGER,
      LessonStageType.VERSE_VISUALS,
      LessonStageType.MANUAL_WORK,
      LessonStageType.VERSE_FIXATION,
    ])
      expect(() => target.lockDerivedVerse(lesson, type, content)).toThrow(
        'ao menos uma peça imprimível',
      );
  });

  it('reports interrupted image connections with a specific diagnostic', () => {
    const target = pureLessonUtils as unknown as {
      describeAiFailure: (
        type: LessonStageType,
        error: unknown,
      ) => { code: string; message: string };
    };
    const failure = target.describeAiFailure(
      LessonStageType.MEDITATION_OLDER,
      new Error(
        'Falha ao gerar imagem na OpenAI: [ECONNRESET] read ECONNRESET',
      ),
    );
    expect(failure.code).toBe('AI_CONNECTION_INTERRUPTED');
    expect(failure.message).toContain('conexão');
    expect(failure.message).not.toContain('não reconhecido');
  });

  it('preserves local validation diagnostics instead of blaming the provider', () => {
    const target = pureLessonUtils as unknown as {
      describeAiFailure: (
        type: LessonStageType,
        error: unknown,
      ) => { code: string; message: string };
    };
    const failure = target.describeAiFailure(
      LessonStageType.MEDITATION_OLDER,
      new ConflictException(
        'O material derivado precisa conter ao menos uma peça imprimível.',
      ),
    );
    expect(failure.code).toBe('AI_CONTENT_INVALID');
    expect(failure.message).toContain('ao menos uma peça imprimível');
    expect(failure.message).not.toContain('provedor');
    expect(failure.message).not.toContain('não reconhecido');
  });

  it('synchronizes manually edited older fields before saving without regenerating or overwriting the document', async () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Tema editado' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'INSTRUÇÃO' }],
        },
        {
          type: 'paragraph',
          attrs: { meditationField: 'firstActivity' },
          content: [
            {
              type: 'text',
              text: 'Questão revisada com os dados corretos.',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    };
    const stage = {
      id: 'stage',
      type: LessonStageType.MEDITATION_OLDER,
      status: LessonStageStatus.DRAFT,
      lockVersion: 7,
      currentVersionId: 'old',
      versions: [
        {
          id: 'old',
          versionNumber: 1,
          structuredDataJson: {
            activities: [{ instruction: 'Questão antiga.', answer: 'Interno' }],
            printableAssets: [],
          },
        },
      ],
    };
    const lesson = {
      id: 'lesson',
      stages: [stage],
      status: LessonStatus.IN_PROGRESS,
    };
    const savedVersions: Array<Record<string, unknown>> = [];
    const localRepo = {
      ...repo,
      runInTransaction: jest.fn(
        async (work: (manager: never) => Promise<unknown>) =>
          work(undefined as never),
      ),
      findLessonByIdForUpdate: jest.fn().mockResolvedValue(lesson),
      findLessonById: jest.fn().mockResolvedValue(lesson),
      createVersion: jest.fn((data: Record<string, unknown>) => data),
      saveVersion: jest.fn((data: Record<string, unknown>) => {
        savedVersions.push(data);
        return Promise.resolve({ ...data, id: 'new' });
      }),
    };
    const instance = createLessonStudio(
      localRepo as unknown as AiLessonsRepository,
      {} as LessonLlmProviderContract,
      {} as AwsS3Service,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      weekMaterialsGet as unknown as WeekMaterialsPageGetService,
      {} as AdminLessonPromptService,
      config,
      media,
    );
    await instance.service.saveContent(
      'lesson',
      {
        stage: LessonStageType.MEDITATION_OLDER,
        lockVersion: 7,
        tiptapAstJson: document,
      },
      'admin',
    );
    expect(savedVersions[0].tiptapAstJson).toEqual(document);
    expect(savedVersions[0].structuredDataJson).toMatchObject({
      title: 'Tema editado',
      activities: [
        {
          instruction: 'Questão revisada com os dados corretos.',
          answer: 'Interno',
        },
      ],
    });
  });

  it('keeps older source excerpts, subitem keys and review metadata out of the editable child document', () => {
    const target = pureLessonUtils as unknown as {
      toTiptap: (
        value: Record<string, unknown>,
        week?: number,
        stage?: LessonStageType,
      ) => Record<string, unknown>;
    };
    const result = target.toTiptap(
      {
        activities: [
          {
            instruction: 'Questão imprimível.',
            answer: 'Gabarito privado.',
            sourceExcerpt: 'Fonte interna.',
            mechanic: 'OTHER',
            subitems: [{ answer: 'Resposta interna.' }],
          },
        ],
      },
      undefined,
      LessonStageType.MEDITATION_OLDER,
    );
    const serialized = JSON.stringify(result);
    expect(serialized).toContain('Questão imprimível.');
    for (const privateText of [
      'Gabarito privado.',
      'Fonte interna.',
      'Resposta interna.',
      'OTHER',
    ])
      expect(serialized).not.toContain(privateText);
  });

  it('uses the approved theme and references for meditation header fields', () => {
    const target = pureLessonUtils as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        content: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const lesson = {
      theme: 'O poder de Jesus sobre a morte',
      biblicalReference: 'João 11:1-44; Lucas 7:11-17',
    } as LessonEntity;
    const result = target.validateCanonicalContent(
      lesson,
      LessonStageType.MEDITATION_OLDER,
      {
        title: 'Meditação para crianças maiores',
        biblicalText: 'Hoje vamos descobrir...',
        introduction: 'Jesus tem poder sobre a morte.',
      },
    );
    expect(result.title).toBe(lesson.theme);
    expect(result.biblicalText).toBe(lesson.biblicalReference);
    expect(result.introduction).toBe('Jesus tem poder sobre a morte.');
  });

  it('entrega ao editor o cabeçalho separado de uma versão já salva', async () => {
    const body = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Texto editado.' }],
    };
    repo.findLessonById.mockResolvedValueOnce({
      id: 'lesson',
      weekNumber: 20,
      stages: [
        {
          type: LessonStageType.LESSON,
          versions: [
            {
              id: 'version',
              versionNumber: 1,
              tiptapAstJson: {
                type: 'doc',
                content: [
                  {
                    type: 'heading',
                    attrs: { level: 1 },
                    content: [{ type: 'text', text: 'LIÇÃO 20 – O SEMEADOR' }],
                  },
                  body,
                ],
              },
            },
          ],
        },
      ],
    });
    const lesson = await service.getById('lesson');
    expect(lesson.stages[0].versions[0].tiptapAstJson.content).toEqual([
      ...['LIÇÃO 20', 'TÍTULO', 'O SEMEADOR'].map((text) => ({
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text }],
      })),
      body,
    ]);
    expect(repo.saveLesson).not.toHaveBeenCalled();
    expect(repo.updateStage).not.toHaveBeenCalled();
  });

  it.each(['GEMINI', 'OPENAI'])(
    'identifica a chave ausente de %s antes de uma chamada ao provedor',
    (provider) => {
      const target = pureLessonUtils as unknown as {
        describeAiFailure: (
          type: LessonStageType,
          error: unknown,
        ) => { code: string; message: string };
      };
      const failure = target.describeAiFailure(
        LessonStageType.LESSON,
        new Error(`${provider}_API_KEY não configurada.`),
      );
      expect(failure.code).toBe('AI_CONFIGURATION_MISSING');
      expect(failure.message).toContain(
        `usando ${provider === 'GEMINI' ? 'Gemini' : 'OpenAI'}`,
      );
      expect(failure.message).toContain('Salve a chave');
      if (provider === 'GEMINI')
        expect(failure.message).not.toContain('OpenAI');
    },
  );

  it('não atribui ao OpenAI uma falha sem identificação de provedor', () => {
    const target = pureLessonUtils as unknown as {
      describeAiFailure: (
        type: LessonStageType,
        error: unknown,
      ) => { code: string; message: string };
    };
    expect(
      target.describeAiFailure(LessonStageType.LESSON, new Error('Falha local'))
        .message,
    ).not.toContain('OpenAI');
  });

  it('traduz saldo esgotado da OpenAI e identifica o item afetado', () => {
    const target = pureLessonUtils as unknown as {
      describeAiFailure: (
        type: LessonStageType,
        error: unknown,
      ) => { code: string; message: string };
    };
    const failure = target.describeAiFailure(
      LessonStageType.MEDITATION_YOUNGER,
      new Error(
        'Falha ao gerar MEDITATION_YOUNGER na OpenAI: {"error":{"type":"insufficient_quota","code":"credit_balance_exhausted"}}',
      ),
    );

    expect(failure.code).toBe('AI_CREDITS_EXHAUSTED');
    expect(failure.message).toContain('6. Meditação dos menores');
    expect(failure.message).toContain('OpenAI');
    expect(failure.message).toContain('créditos da conta acabaram');
    expect(failure.message).not.toContain('insufficient_quota');
  });

  it('explica faturamento OpenAI inativo em vez de erro desconhecido', () => {
    const target = pureLessonUtils as unknown as {
      describeAiFailure: (
        type: LessonStageType,
        error: unknown,
      ) => { code: string; message: string };
    };
    const failure = target.describeAiFailure(
      LessonStageType.LESSON,
      new Error('OpenAI: {"error":{"code":"billing_not_active"}}'),
    );
    expect(failure.code).toBe('AI_BILLING_INACTIVE');
    expect(failure.message).toContain('faturamento da conta não está ativo');
  });

  it('traduz cota esgotada do Gemini e identifica o item afetado', () => {
    const target = pureLessonUtils as unknown as {
      describeAiFailure: (
        type: LessonStageType,
        error: unknown,
      ) => { code: string; message: string };
    };
    const failure = target.describeAiFailure(
      LessonStageType.VERSE_FIXATION,
      new Error(
        'Falha no Gemini: {"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}',
      ),
    );

    expect(failure.code).toBe('AI_RATE_LIMITED');
    expect(failure.message).toContain('5. Fixação divertida do versículo');
    expect(failure.message).toContain('Gemini');
    expect(failure.message).toContain('limite de uso');
  });

  it('preserva a instrução da meditação quando a atividade também contém gabarito', () => {
    const target = pureLessonUtils as unknown as {
      toTiptap: (
        value: Record<string, unknown>,
        weekNumber?: number,
        stageType?: LessonStageType,
      ) => Record<string, unknown>;
    };
    const document = target.toTiptap(
      {
        activities: [
          {
            number: 1,
            instruction: 'Pinte Jesus e seus amigos.',
            answer: 'Jesus está vivo.',
          },
          {
            number: 2,
            instruction: 'Pinte a segunda cena.',
            answer: 'Jesus cuida de nós.',
          },
        ],
      },
      undefined,
      LessonStageType.MEDITATION_YOUNGER,
    );
    const serialized = JSON.stringify(document);
    expect(serialized).toContain('Pinte Jesus e seus amigos.');
    expect(serialized).toContain('Pinte a segunda cena.');
    expect(serialized).toContain('Jesus está vivo.');
  });

  it('une o versículo e traduz todos os rótulos da fixação para português', () => {
    const target = pureLessonUtils as unknown as {
      toTiptap: (value: Record<string, unknown>) => Record<string, unknown>;
    };
    const document = target.toTiptap({
      name: 'Missão do Versículo',
      funMechanics: ['Movimento', 'Descoberta'],
      verseText: 'Eu sou a ressurreição e a vida.',
      verseReference: 'João 11:25-26',
      verseVersion: 'NVI',
      ageAdaptations: {
        ages5To7: 'Use gestos simples.',
        ages8To11: 'Monte o texto sem ajuda.',
      },
    });
    const serialized = JSON.stringify(document);

    expect(serialized).toContain('VERSÍCULO PARA MEMORIZAR');
    expect(serialized).toContain('“Eu sou a ressurreição e a vida.”');
    expect(serialized).toContain('João 11:25-26 — NVI');
    expect(serialized).toContain('MECÂNICAS DIVERTIDAS');
    expect(serialized).toContain('CRIANÇAS DE 5 A 7 ANOS');
    expect(serialized).toContain('CRIANÇAS DE 8 A 11 ANOS');
    expect(serialized).not.toContain('FUN MECHANICS');
    expect(serialized).not.toContain('AGES8TO11');
  });

  it.each([true, false])(
    'uses distinct lease UUIDs within the persisted column limit when claimed=%s',
    async (claimed) => {
      const tokens = [
        '005eda9e-6cba-4ac9-a310-4328d6a55838',
        'c981c1d7-6ebd-4f57-8a23-d89caa989295',
      ] as const;
      const uuid = jest
        .spyOn(crypto, 'randomUUID')
        .mockReturnValueOnce(tokens[0])
        .mockReturnValueOnce(tokens[1]);
      const target = studio.generation as unknown as {
        startGeneration: (stage: LessonStageEntity, token: string) => void;
      };
      const start = jest
        .spyOn(target, 'startGeneration')
        .mockImplementation(() => undefined);
      const stage = Object.assign(new LessonStageEntity(), {
        id: 'stage-pending',
        lessonId: 'lesson-pending',
        type: LessonStageType.LESSON_VISUALS,
        status: LessonStageStatus.GENERATING,
        generationLeaseOwner: null,
        generationRequestJson: { stage: LessonStageType.LESSON_VISUALS },
        generationRequestedById: 'producer',
      });
      const column = getMetadataArgsStorage().columns.find(
        (item) =>
          item.target === LessonStageEntity &&
          item.propertyName === 'generationLeaseOwner',
      );
      repo.findGeneratingStages.mockResolvedValue([stage]);
      repo.claimGeneration.mockResolvedValue(claimed);

      try {
        await studio.generation.onApplicationBootstrap();
        await studio.generation.resumePendingGenerations();

        expect(repo.claimGeneration).toHaveBeenCalledTimes(tokens.length);
        for (const [index, token] of tokens.entries()) {
          const owner = (
            repo.claimGeneration.mock.calls[index] as [string, string, number]
          )[1];
          expect(owner.length).toBeLessThanOrEqual(
            Number(column?.options.length),
          );
          expect(repo.claimGeneration).toHaveBeenNthCalledWith(
            index + 1,
            stage.id,
            token,
            LESSON_GENERATION.LEASE_SECONDS,
          );
          if (claimed)
            expect(start).toHaveBeenNthCalledWith(index + 1, stage, token);
        }
        expect(start).toHaveBeenCalledTimes(claimed ? tokens.length : 0);
        expect(stage.generationLeaseOwner).toBe(claimed ? tokens[1] : null);
      } finally {
        start.mockRestore();
        uuid.mockRestore();
        repo.findGeneratingStages.mockResolvedValue([]);
        repo.claimGeneration.mockReset();
      }
    },
  );

  it('marca como falha uma geração legada sem dados persistidos para retomada', async () => {
    const stage = {
      id: 'stage-legacy',
      lessonId: 'lesson-legacy',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.GENERATING,
      currentVersionId: null,
      generationRequestJson: null,
      generationRequestedById: null,
      failureCode: null,
      failureMessage: null,
    };
    const lesson = {
      id: 'lesson-legacy',
      status: LessonStatus.IN_PROGRESS,
      stages: [stage],
    } as unknown as LessonEntity;
    repo.findGeneratingStages.mockResolvedValue([stage]);
    repo.findLessonById.mockResolvedValue(lesson);

    await studio.generation.onApplicationBootstrap();

    expect(stage.status).toBe(LessonStageStatus.FAILED);
    expect(stage.failureCode).toBe('GENERATION_REQUEST_MISSING');
    expect(repo.claimGeneration).not.toHaveBeenCalled();
    // Written under the lesson lock, never from the unlocked listing snapshot.
    expect(repo.saveStage).not.toHaveBeenCalled();
    expect(repo.findLessonByIdForUpdate).toHaveBeenCalledWith(
      'lesson-legacy',
      expect.anything(),
    );
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
    const otherStages = Object.values(LessonStageType)
      .filter((type) => type !== LessonStageType.LESSON)
      .map((type) => ({
        id: `stage-${type}`,
        type,
        status: LessonStageStatus.PRODUCER_APPROVED,
        currentVersionId: `version-${type}`,
        versions: [{ id: `version-${type}` }],
      }));
    const lesson = {
      id: 'lesson-1',
      status: LessonStatus.DRAFT,
      stages: [stage, ...otherStages],
    } as unknown as LessonEntity;
    repo.findLessonById.mockResolvedValue(lesson);

    await service.completeProductionStage(
      'lesson-1',
      LessonStageType.LESSON,
      UNVERSIONED,
    );

    expect(repo.updateStage).toHaveBeenCalledWith(
      'stage-1',
      {
        status: LessonStageStatus.PRODUCER_APPROVED,
        approvedAt: null,
        approvedById: null,
        failureCode: null,
        failureMessage: null,
      },
      expect.anything(),
    );
    expect(repo.updateLesson).toHaveBeenCalledWith(
      'lesson-1',
      {
        status: LessonStatus.PACKAGE_READY,
      },
      expect.anything(),
    );
    expect(repo.saveStage).not.toHaveBeenCalled();
    expect(repo.saveLesson).not.toHaveBeenCalled();
  });

  it('publishes all eight approved items as distinct PDFs on one weekly page', async () => {
    const lesson = {
      id: 'lesson-1',
      weekNumber: 14,
      theme: 'Tema aprovado',
      biblicalReference: 'João 11',
      status: LessonStatus.READY_FOR_PUBLICATION,
      weekMaterialId: null,
      stages: Object.values(LessonStageType).map((type) => ({
        type,
        status: LessonStageStatus.APPROVED,
        currentVersionId: `version-${type}`,
      })),
    } as unknown as LessonEntity;
    repo.runInTransaction.mockImplementation(
      async (work: (manager: object) => Promise<unknown>) => work({}),
    );
    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);
    repo.findLessonById.mockResolvedValue(lesson);
    weekMaterials.createWeekMaterialsPage.mockResolvedValue({ id: 'page-1' });
    const render = jest
      .spyOn(
        studio.pdfExport as unknown as {
          renderStagePdf: (
            lesson: LessonEntity,
            type: LessonStageType,
          ) => Promise<{ pdfBuffer: Buffer; fileName: string }>;
        },
        'renderStagePdf',
      )
      .mockImplementation((_lesson, type) =>
        Promise.resolve({
          pdfBuffer: Buffer.from(type),
          fileName: 'preview.pdf',
        }),
      );
    try {
      await service.publishToWeekMaterial('lesson-1');
      expect(render).toHaveBeenCalledTimes(8);
      const [dto, files] = weekMaterials.createWeekMaterialsPage.mock
        .calls[0] as [
        import('src/modules/pages/week-material-page/dto/create-week-material.dto').CreateWeekMaterialsPageDto,
        Record<string, Express.Multer.File>,
      ];
      expect(dto.pageTitle).toBe('Semana 14 — Tema aprovado');
      expect(dto.documents).toHaveLength(8);
      expect(new Set(dto.documents?.map((doc) => doc.fieldKey)).size).toBe(8);
      for (const type of Object.values(LessonStageType)) {
        expect(files[`generated-${type.toLowerCase()}`].buffer.toString()).toBe(
          type,
        );
      }
      expect(lesson.status).toBe(LessonStatus.PUBLISHED);
      expect(lesson.weekMaterialId).toBe('page-1');
    } finally {
      render.mockRestore();
    }
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

  it('restores readiness if exporting the PDF fails before creating the weekly material', async () => {
    const lesson = {
      id: 'lesson-1',
      status: LessonStatus.READY_FOR_PUBLICATION,
      weekMaterialId: null,
      stages: Object.values(LessonStageType).map((type, index) => ({
        id: `stage-${index}`,
        type,
        status: LessonStageStatus.APPROVED,
        currentVersionId: `version-${index}`,
      })),
    } as unknown as LessonEntity;
    repo.runInTransaction.mockImplementation(
      async (work: (manager: object) => Promise<unknown>) => work({}),
    );
    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);
    repo.findLessonById.mockResolvedValue(lesson);
    const exportPdf = jest
      .spyOn(
        studio.pdfExport as unknown as {
          renderStagePdf: () => Promise<{
            pdfBuffer: Buffer;
            fileName: string;
          }>;
        },
        'renderStagePdf',
      )
      .mockResolvedValueOnce({
        pdfBuffer: Buffer.from('first'),
        fileName: 'first.pdf',
      })
      .mockResolvedValueOnce({
        pdfBuffer: Buffer.from('second'),
        fileName: 'second.pdf',
      })
      .mockRejectedValue(new ConflictException('PDF sem espaço.'));
    try {
      await expect(service.publishToWeekMaterial('lesson-1')).rejects.toThrow(
        'PDF sem espaço.',
      );
      expect(exportPdf).toHaveBeenCalledTimes(3);
      expect(lesson.status).toBe(LessonStatus.READY_FOR_PUBLICATION);
      expect(repo.reservePublication).toHaveBeenCalledTimes(1);
      // The failure names the item whose PDF could not be produced.
      expect(lesson.publicationFailureMessage).toBe(
        'Brincadeira: PDF sem espaço.',
      );
      expect(lesson.publicationLeaseOwner).toBeNull();
      expect(weekMaterials.createWeekMaterialsPage).not.toHaveBeenCalled();
    } finally {
      exportPdf.mockRestore();
    }
  });
  it('rejeita uma segunda publicação enquanto a primeira está em andamento', async () => {
    repo.runInTransaction.mockImplementation(
      async (work: (manager: object) => Promise<unknown>) => work({}),
    );
    repo.findLessonByIdForUpdate.mockResolvedValue({
      id: 'lesson-1',
      status: LessonStatus.PUBLISHING,
      stages: [],
    } as unknown as LessonEntity);
    repo.isPublicationLeaseActive.mockResolvedValue(true);
    await expect(
      service.publishToWeekMaterial('lesson-1'),
    ).rejects.toBeInstanceOf(AppConflictException);
  });

  it('nunca aprova etapas implicitamente ao tentar publicar', async () => {
    const stages = Object.values(LessonStageType).map((type, index) => ({
      id: `stage-${index}`,
      type,
      status:
        index === 0 ? LessonStageStatus.APPROVED : LessonStageStatus.IN_REVIEW,
      currentVersionId: `version-${index}`,
    }));
    repo.runInTransaction.mockImplementation(
      async (work: (manager: object) => Promise<unknown>) => work({}),
    );
    repo.findLessonByIdForUpdate.mockResolvedValue({
      id: 'lesson-1',
      status: LessonStatus.IN_REVIEW,
      stages,
    } as unknown as LessonEntity);

    await expect(
      service.publishToWeekMaterial('lesson-1'),
    ).rejects.toBeInstanceOf(AppConflictException);
    expect(repo.saveStage).not.toHaveBeenCalled();
    expect(repo.updateStage).not.toHaveBeenCalled();
    expect(weekMaterials.createWeekMaterialsPage).not.toHaveBeenCalled();
  });

  it('exige observação ao solicitar ajustes', async () => {
    await expect(
      service.requestChanges(
        'lesson-1',
        LessonStageType.LESSON,
        '   ',
        'reviewer-1',
        UNVERSIONED,
      ),
    ).rejects.toThrow('Descreva os ajustes necessários');
    expect(repo.runInTransaction).not.toHaveBeenCalled();
  });

  it.each([
    new Error('Gemini: {"error":{"code":"MAX_TOKENS"}}'),
    new Error('Resposta incompleta da OpenAI: max_output_tokens'),
  ])(
    'mostra mensagem específica para resposta interrompida de qualquer provedor',
    (error) => {
      const target = pureLessonUtils as unknown as {
        describeAiFailure: (
          stage: LessonStageType,
          error: unknown,
        ) => { code: string; message: string };
      };
      const failure = target.describeAiFailure(LessonStageType.LESSON, error);
      expect(failure.code).toBe('AI_INCOMPLETE_RESPONSE');
      expect(failure.message).toContain('versão anterior foi preservada');
    },
  );

  it('rejeita narrativa interrompida mesmo com um JSON de lição válido', () => {
    const target = pureLessonUtils as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        stage: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
      describeAiFailure: (
        stage: LessonStageType,
        error: unknown,
      ) => { code: string; message: string };
    };
    expect(() =>
      target.validateCanonicalContent(
        {} as LessonEntity,
        LessonStageType.LESSON,
        { story: 'Jesus respondeu: "Se podes?' },
      ),
    ).toThrow('Conteúdo incompleto da lição');
    const failure = target.describeAiFailure(
      LessonStageType.LESSON,
      new ConflictException('Conteúdo incompleto da lição: fala interrompida.'),
    );
    expect(failure.code).toBe('AI_INCOMPLETE_RESPONSE');
    expect(failure.message).toContain('versão anterior foi preservada');
  });

  it('renumera os IDs das cenas em vez de reprovar a lição gerada', () => {
    const target = pureLessonUtils as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const result = target.validateCanonicalContent(
      { biblicalReference: 'Lucas 16:19-31' } as LessonEntity,
      LessonStageType.LESSON,
      {
        story:
          'Jesus contou a parábola. Ele ensinou que a decisão é feita nesta vida.',
        memoryVerse: {
          text: 'Asseguro a vocês que aquele que crê tem a vida eterna.',
          reference: 'João 6:47',
          version: 'NVI',
        },
        visualScenes: [
          { id: 'cena-1', purpose: 'a' },
          { id: 'scene-1', purpose: 'b' },
          { id: 'scene-1', purpose: 'c' },
        ],
      },
    );
    expect(result.visualScenes).toEqual([
      { id: 'scene-01', purpose: 'a' },
      { id: 'scene-02', purpose: 'b' },
      { id: 'scene-03', purpose: 'c' },
    ]);
  });

  it('remove os campos internos de raciocínio antes de salvar a lição', () => {
    const target = pureLessonUtils as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const result = target.validateCanonicalContent(
      { biblicalReference: 'Lucas 16:19-31' } as LessonEntity,
      LessonStageType.LESSON,
      {
        centralMessage:
          'O destino eterno se decide nesta vida, crendo em Jesus.',
        verseChoice: 'João 6:47 liga crer em Jesus à vida eterna.',
        reviewerNotes: 'Conferir a redação NVI de Lucas 16:31.',
        story:
          'Jesus contou a parábola. Ele ensinou que a decisão é feita nesta vida.',
        memoryVerse: {
          text: 'Asseguro a vocês que aquele que crê tem a vida eterna.',
          reference: 'João 6:47',
          version: 'NVI',
        },
        visualScenes: [{ id: 'scene-01' }],
      },
    );

    expect(result).not.toHaveProperty('centralMessage');
    expect(result).not.toHaveProperty('verseChoice');
    expect(result).not.toHaveProperty('reviewerNotes');
    expect(result.memoryVerse).toMatchObject({ reference: 'João 6:47' });
  });

  it('mantém a referência bíblica cadastrada como valor canônico', () => {
    const target = pureLessonUtils as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const generated = {
      biblicalReference: 'João 3.16',
      story:
        'Jesus mostrou o amor de Deus. A história terminou com seu ensino.',
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
    const target = pureLessonUtils as unknown as {
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
    const target = pureLessonUtils as unknown as {
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

  it('aceita a brincadeira divertida com uma única imagem de compilado', () => {
    const target = pureLessonUtils as unknown as {
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
          id: 'compilado-01',
          purpose: 'Resumo',
          prompt: 'Infográfico',
          altText: 'Resumo',
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

  it('rejeita brincadeira divertida longa demais para uma página', () => {
    const target = pureLessonUtils as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const compiled = [
      {
        id: 'compilado-01',
        purpose: 'Resumo',
        prompt: 'Infográfico',
        altText: 'Resumo',
      },
    ];
    expect(() =>
      target.validateCanonicalContent(
        {} as LessonEntity,
        LessonStageType.STANDARD_GAME,
        {
          steps: ['1', '2', '3', '4', '5', '6', '7'],
          assets: compiled,
        },
      ),
    ).toThrow('documento de uma página');
    expect(() =>
      target.validateCanonicalContent(
        {} as LessonEntity,
        LessonStageType.STANDARD_GAME,
        {
          steps: ['1', '2', '3'],
          rulesAndSafety: ['a', 'b', 'c', 'd', 'e'],
          assets: compiled,
        },
      ),
    ).toThrow('documento de uma página');
  });

  it('rejeita a brincadeira divertida com uma imagem por passo em vez do compilado', () => {
    const target = pureLessonUtils as unknown as {
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

  it('exige um visual instrucional para cada passo da fixação do versículo', () => {
    const target = pureLessonUtils as unknown as {
      validateCanonicalContent: (
        lesson: LessonEntity,
        type: LessonStageType,
        generated: Record<string, unknown>,
      ) => Record<string, unknown>;
    };
    const generated = {
      steps: ['Monte o versículo em grupo.', 'Recite o versículo completo.'],
      assets: [
        {
          id: 'instrucao-01',
          stepNumber: 1,
          instruction: 'Monte o versículo em grupo.',
        },
        {
          id: 'instrucao-02',
          stepNumber: 2,
          instruction: 'Recite o versículo completo.',
        },
      ],
    };

    expect(
      target.validateCanonicalContent(
        {} as LessonEntity,
        LessonStageType.VERSE_FIXATION,
        generated,
      ),
    ).toBe(generated);
  });

  it('considera nova somente uma brincadeira com nome, mecânicas e passos diferentes', () => {
    const target = pureLessonUtils as unknown as {
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
        name: 'Trilha da Alegria!',
        funMechanics: ['busca', 'movimento'],
      }),
    ).toBe(false);
  });

  it('rejeita nome ou dinâmica reutilizados de qualquer versão anterior', () => {
    const target = pureLessonUtils as unknown as {
      isNewGameFromHistory: (
        previous: Array<Record<string, unknown>>,
        candidate: Record<string, unknown>,
      ) => boolean;
    };
    const history = [
      {
        name: 'Caça às pistas',
        funMechanics: ['busca', 'cooperação'],
        steps: ['Encontre uma pista.', 'Monte a resposta.'],
      },
      {
        name: 'Torre da amizade',
        funMechanics: ['construção', 'ritmo'],
        steps: ['Escolha uma peça.', 'Construa a torre.'],
      },
    ];

    expect(
      target.isNewGameFromHistory(history, {
        name: 'Caça as Pistas!',
        funMechanics: ['movimento', 'imitação'],
        steps: ['Imite um gesto.', 'Troque de lugar.'],
      }),
    ).toBe(false);
  });

  it('aplica a quebra da IA usando somente o texto canônico do versículo', () => {
    const target = pureLessonUtils as unknown as {
      canonicalizeVerseVisualAssets: (
        verseText: string,
        assets: Array<Record<string, unknown>>,
      ) => Array<Record<string, unknown>>;
    };
    const canonical = 'Disse-lhe Jesus: Eu sou a ressurreição e a vida.';
    const assets = target.canonicalizeVerseVisualAssets(canonical, [
      { id: 'parte-01', displayText: 'Disse Jesus eu sou' },
      { id: 'parte-02', displayText: 'a ressurreição' },
      { id: 'parte-03', displayText: 'e a vida .' },
    ]);

    expect(assets.map((asset) => asset.displayText).join(' ')).toBe(canonical);
    expect(assets[0].displayText).toBe('Disse-lhe Jesus: Eu sou');
    expect(assets[2].displayText).toBe('e a vida.');
  });

  it('rejeita mais visuais de conteúdo do que palavras no versículo', () => {
    const target = pureLessonUtils as unknown as {
      canonicalizeVerseVisualAssets: (
        verseText: string,
        assets: Array<Record<string, unknown>>,
      ) => Array<Record<string, unknown>>;
    };

    expect(() =>
      target.canonicalizeVerseVisualAssets('Jesus vive.', [
        { displayText: 'Jesus' },
        { displayText: 'vive' },
        { displayText: '.' },
      ]),
    ).toThrow(ConflictException);
  });

  it('exibe a versão do versículo uma única vez no documento gerado', () => {
    const target = pureLessonUtils as unknown as {
      toTiptap: (value: Record<string, unknown>) => Record<string, unknown>;
    };
    const document = target.toTiptap({
      memoryVerse: {
        text: 'Eu sou o pão da vida.',
        reference: 'João 6:35 NVI',
        version: 'NVI',
      },
    });
    expect(JSON.stringify(document)).toContain('João 6:35 — NVI');
    expect(JSON.stringify(document)).not.toContain('João 6:35 NVI — NVI');
  });

  it('mantém a ordem editorial, oculta oração vazia e deixa as cenas fora da narrativa', () => {
    const target = pureLessonUtils as unknown as {
      toTiptap: (value: Record<string, unknown>) => {
        content: Array<{ type: string; content?: Array<{ text?: string }> }>;
      };
    };
    const tiptap = target.toTiptap({
      closingPrayer: '',
      reviewQuestions: Array.from({ length: 8 }, (_, index) => ({
        question: `Pergunta ${index + 1}?`,
        answer: 'Resposta completa.',
      })),
      counseling: 'Acolha a criança e consulte o manual.',
      story: 'Crianças, vocês já tiveram dúvidas? (aguarde as respostas)',
      title: 'LIÇÃO 26: RESSURREIÇÃO',
      visualScenes: [{ id: 'scene-01', prompt: 'Descrição de arte separada.' }],
    });
    const headings = tiptap.content
      .filter((node) => node.type === 'heading')
      .map((node) => node.content?.[0]?.text);
    expect(headings).toEqual([
      'LIÇÃO 26',
      'TÍTULO',
      'RESSURREIÇÃO',
      'LIÇÃO BÍBLICA',
      'ACONSELHAMENTO / CANTINHO DO ACONSELHAMENTO',
      'PERGUNTAS DA LIÇÃO',
    ]);
    const serialized = JSON.stringify(tiptap);
    expect(serialized).toContain('(aguarde as respostas)');
    expect(serialized).toContain('8. Pergunta 8?');
    expect(serialized).not.toContain('Descrição de arte separada');
    expect(serialized).not.toContain('FALANDO COM DEUS');
    const withPrayer = target.toTiptap({
      story: 'História.',
      closingPrayer: 'Obrigado, Deus.',
    });
    expect(JSON.stringify(withPrayer)).toContain('FALANDO COM DEUS');
    expect(JSON.stringify(withPrayer)).toContain('Obrigado, Deus.');
  });

  it('destaca as duas sub-histórias como títulos H3 mantendo a abertura e a ordem', () => {
    const target = pureLessonUtils as unknown as {
      toTiptap: (value: Record<string, unknown>) => {
        content: Array<{
          type: string;
          attrs?: { level?: number; textAlign?: string };
          content?: Array<{ text?: string }>;
        }>;
      };
    };
    const document = target.toTiptap({
      story:
        'Hoje veremos duas histórias.\n\n### A Primeira Multiplicação dos Pães (Mateus 14:13-21)\n\nCinco pães e dois peixes.\n\n### A Segunda Multiplicação dos Pães (Mateus 15:29-39)\n\nSete pães e alguns peixes.',
      applicationAndAppeal: 'Aplicação conjunta.',
    });
    const subheadings = document.content.filter(
      (node) => node.type === 'heading' && node.attrs?.level === 3,
    );
    expect(subheadings.map((node) => node.content?.[0]?.text)).toEqual([
      'A Primeira Multiplicação dos Pães (Mateus 14:13-21)',
      'A Segunda Multiplicação dos Pães (Mateus 15:29-39)',
    ]);
    expect(subheadings.every((node) => node.attrs?.textAlign === 'left')).toBe(
      true,
    );
    expect(JSON.stringify(document)).not.toContain('###');
    expect(JSON.stringify(document)).toContain('Hoje veremos duas histórias.');
    expect(JSON.stringify(document)).toContain('Sete pães e alguns peixes.');
    expect(
      document.content
        .filter((node) => node.type === 'heading' && node.attrs?.level === 2)
        .map((node) => node.content?.[0]?.text),
    ).toEqual(['LIÇÃO BÍBLICA', 'APLICAÇÃO E APELO']);
  });

  it('preserva compatibilidade com marcadores de cena de versões antigas em toTiptap', () => {
    const target = pureLessonUtils as unknown as {
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
    const target = pureLessonUtils as unknown as {
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
    const target = pureLessonUtils as unknown as {
      validateVisualConfig: (dto: {
        visualType: string;
        visualOrientation: string;
        visualQuantity: number;
      }) => unknown;
    };
    const base = {
      visualType: 'CUTOUT_KIT',
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

  it('T-B01: ciclo de revisão permite devolver etapa 8, aprovar etapa 1, editar etapa 8 e submeter mantendo aprovações intactas', async () => {
    const stage1 = {
      id: 'stage-lesson',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.IN_REVIEW,
      currentVersionId: 'v1',
      versions: [
        {
          id: 'v1',
          versionNumber: 1,
          structuredDataJson: {
            theme: 'Tema',
            biblicalReference: 'João 3:16',
            passage: 'João 3',
            verse: 'Porque Deus amou...',
            story: 'História inicial.',
            memoryVerse: {
              text: 'Porque Deus amou o mundo.',
              reference: 'João 3:16',
              version: 'NVI',
            },
          },
        },
      ],
    };
    const stage8 = {
      id: 'stage-manual',
      type: LessonStageType.MANUAL_WORK,
      status: LessonStageStatus.IN_REVIEW,
      currentVersionId: 'v8',
      versions: [
        {
          id: 'v8',
          versionNumber: 1,
          structuredDataJson: {
            verseText: 'Porque Deus amou o mundo.',
            verseReference: 'João 3:16',
            verseVersion: 'NVI',
            printableAssets: [
              {
                id: 'manual',
                url: 'https://bucket.s3.amazonaws.com/test/uploads/1762700000000_ab12cd34_lesson-cycle-MANUAL_WORK-manual.png',
              },
            ],
          },
        },
      ],
    };
    const otherStages = LESSON_STAGE_ORDER.filter(
      (type) =>
        type !== LessonStageType.LESSON && type !== LessonStageType.MANUAL_WORK,
    ).map((type, i) => ({
      id: `stage-${type}`,
      type,
      status: LessonStageStatus.IN_REVIEW,
      currentVersionId: `v-${i}`,
      versions: [{ id: `v-${i}`, versionNumber: 1, structuredDataJson: {} }],
    }));

    const lesson = {
      id: 'lesson-cycle',
      theme: 'Tema',
      biblicalReference: 'João 3:16',
      weekNumber: 1,
      status: LessonStatus.IN_REVIEW,
      stages: [stage1, ...otherStages, stage8],
      comments: [],
    } as unknown as LessonEntity;

    repo.findLessonById.mockResolvedValue(lesson);
    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);

    // 1. Devolver etapa 8 (requestChanges)
    await service.requestChanges(
      'lesson-cycle',
      LessonStageType.MANUAL_WORK,
      'Ajustar trabalho manual',
      'rev-1',
      UNVERSIONED,
    );
    expect(stage8.status).toBe(LessonStageStatus.CHANGES_REQUESTED);
    expect(lesson.status).toBe(LessonStatus.CHANGES_REQUESTED);

    // 2. Aprovar etapa 1 enquanto lesson está em CHANGES_REQUESTED
    const renderPdf = jest
      .spyOn(studio.pdfExport, 'renderStagePdf')
      .mockResolvedValue({ pdfBuffer: Buffer.from('pdf'), fileName: 'a.pdf' });
    await service.approveStage(
      'lesson-cycle',
      LessonStageType.LESSON,
      'rev-1',
      UNVERSIONED,
    );
    expect(stage1.status).toBe(LessonStageStatus.APPROVED);
    expect(lesson.status).toBe(LessonStatus.CHANGES_REQUESTED);
    renderPdf.mockRestore();

    // 3. Produtor edita etapa 8 via saveContent
    (stage8 as Record<string, unknown>).lockVersion = 1;
    repo.createVersion.mockImplementation((d: Record<string, unknown>) => d);
    repo.saveVersion.mockImplementation((d: Record<string, unknown>) => {
      const saved = { ...d, id: 'v8-new', versionNumber: 2 };
      (stage8.versions as Array<Record<string, unknown>>).push(saved);
      return Promise.resolve(saved);
    });
    await service.saveContent(
      'lesson-cycle',
      {
        stage: LessonStageType.MANUAL_WORK,
        lockVersion: 1,
        tiptapAstJson: {
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Novo trabalho manual' }],
            },
          ],
        },
      },
      'prod-1',
    );
    expect(stage8.status).toBe(LessonStageStatus.DRAFT);
    expect(stage1.status).toBe(LessonStageStatus.APPROVED);
    expect(lesson.status).toBe(LessonStatus.IN_PROGRESS);

    // 4. Produtor conclui etapa 8 via completeProductionStage
    otherStages.forEach((s) => (s.status = LessonStageStatus.APPROVED));
    await service.completeProductionStage(
      'lesson-cycle',
      LessonStageType.MANUAL_WORK,
      1,
    );
    expect(stage8.status).toBe(LessonStageStatus.PRODUCER_APPROVED);
    expect(stage1.status).toBe(LessonStageStatus.APPROVED);
    expect(lesson.status).toBe(LessonStatus.PACKAGE_READY);

    // 5. Produtor submete pacote para revisão via submitPackageReview
    await service.submitPackageReview('lesson-cycle');
    expect(stage8.status).toBe(LessonStageStatus.IN_REVIEW);
    expect(stage1.status).toBe(LessonStageStatus.APPROVED);
    expect(lesson.status).toBe(LessonStatus.IN_REVIEW);
  });

  it('T-B02: saveContent rejeita com ConflictException quando lockVersion for desatualizada', async () => {
    const stage = {
      id: 'stage-1',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.DRAFT,
      lockVersion: 3,
      currentVersionId: 'v1',
      versions: [{ id: 'v1', versionNumber: 3 }],
    };
    const lesson = {
      id: 'lesson-conflict',
      status: LessonStatus.IN_PROGRESS,
      stages: [stage],
    } as unknown as LessonEntity;

    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);
    repo.findLessonById.mockResolvedValue(lesson);

    await expect(
      service.saveContent(
        'lesson-conflict',
        {
          stage: LessonStageType.LESSON,
          lockVersion: 2,
          tiptapAstJson: { type: 'doc', content: [] },
        },
        'user-1',
      ),
    ).rejects.toThrow(AppConflictException);
  });

  it('T-B03: completeProductionStage reverte transação e propaga erro se updateLesson falhar', async () => {
    const stage = {
      id: 'stage-1',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.DRAFT,
      currentVersionId: 'v1',
      versions: [{ id: 'v1' }],
    };
    const lesson = {
      id: 'lesson-atomic',
      status: LessonStatus.IN_PROGRESS,
      stages: [stage],
    } as unknown as LessonEntity;

    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);
    repo.findLessonById.mockResolvedValue(lesson);
    repo.updateLesson.mockRejectedValueOnce(new Error('DB connection failure'));

    await expect(
      service.completeProductionStage(
        'lesson-atomic',
        LessonStageType.LESSON,
        UNVERSIONED,
      ),
    ).rejects.toThrow('DB connection failure');
  });

  it('T-B04: commit de geração é abortado quando generationLeaseOwner foi preemptado', async () => {
    const s3DeleteMock = jest.fn().mockResolvedValue(undefined);
    const localS3 = {
      upload: jest.fn(),
      delete: s3DeleteMock,
    } as unknown as AwsS3Service;

    const stage = {
      id: 'stage-gen',
      lessonId: 'lesson-gen',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.GENERATING,
      generationLeaseOwner: 'worker-another:uuid-456',
      generationRequestJson: {
        stage: LessonStageType.LESSON,
        theme: 'Tema',
        weekNumber: 1,
        biblicalReference: 'Gênesis 1',
      },
      generationRequestedById: 'user-1',
      versions: [],
    };
    const lesson = {
      id: 'lesson-gen',
      theme: 'Tema',
      weekNumber: 1,
      biblicalReference: 'Gênesis 1',
      status: LessonStatus.IN_PROGRESS,
      stages: [stage],
    } as unknown as LessonEntity;

    const testService = createLessonStudio(
      repo as unknown as AiLessonsRepository,
      {
        generateStage: jest.fn().mockResolvedValue({
          responseId: 'resp-1',
          content: { structuredDataJson: { story: 'História' } },
        }),
      } as unknown as LessonLlmProviderContract,
      localS3,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      weekMaterialsGet as unknown as WeekMaterialsPageGetService,
      {
        effective: jest.fn().mockResolvedValue(''),
      } as unknown as AdminLessonPromptService,
      config,
      media,
    );

    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);
    repo.findLessonById.mockResolvedValue(lesson);

    const target = testService.generation as unknown as {
      executeStageGeneration: (
        id: string,
        dto: unknown,
        userId: string,
        attemptToken: string,
      ) => Promise<void>;
    };

    await target.executeStageGeneration(
      stage.lessonId,
      stage.generationRequestJson,
      stage.generationRequestedById,
      'worker-me:uuid-123',
    );

    expect(repo.saveVersion).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'commits older meditation with unchanged upstream after the lock query omits versions (reordered=%s)',
    async (reordered) => {
      const content = olderMeditationFixture();
      const attemptToken = '005eda9e-6cba-4ac9-a310-4328d6a55838';
      const lesson = Object.assign(new LessonEntity(), {
        id: 'lesson-older-upstream',
        theme: content.title,
        biblicalReference: content.biblicalText,
        weekNumber: 5,
        status: LessonStatus.IN_PROGRESS,
        stages: LESSON_STAGE_ORDER.map((type) =>
          Object.assign(new LessonStageEntity(), {
            id: `stage-${type}`,
            lessonId: 'lesson-older-upstream',
            type,
            status:
              type === LessonStageType.MEDITATION_OLDER
                ? LessonStageStatus.GENERATING
                : type === LessonStageType.MANUAL_WORK
                  ? LessonStageStatus.NOT_STARTED
                  : LessonStageStatus.PRODUCER_APPROVED,
            generationLeaseOwner:
              type === LessonStageType.MEDITATION_OLDER ? attemptToken : null,
            currentVersionId: `version-${type}`,
            versions: [
              Object.assign(new LessonVersionEntity(), {
                id: `version-${type}`,
                versionNumber: 1,
                structuredDataJson:
                  type === LessonStageType.LESSON
                    ? {
                        ...OLDER_MEDITATION_SOURCE,
                        memoryVerse: {
                          text: content.verseText,
                          reference: content.verseReference,
                          version: content.verseVersion,
                        },
                      }
                    : { marker: type },
              }),
            ],
          }),
        ),
      });
      const refreshed = structuredClone(lesson);
      if (reordered) refreshed.stages.reverse();
      const locked = Object.assign(new LessonEntity(), {
        ...refreshed,
        stages: refreshed.stages.map((stage) =>
          Object.assign(new LessonStageEntity(), {
            id: stage.id,
            type: stage.type,
            status: stage.status,
            currentVersionId: stage.currentVersionId,
            generationLeaseOwner: stage.generationLeaseOwner,
          }),
        ),
      });
      const llm = {
        generateStage: jest
          .fn<Promise<LessonLlmGenerationResult>, [LessonLlmGenerationInput]>()
          .mockResolvedValue({
            responseId: 'review-ok',
            content: { issues: [] },
          })
          .mockResolvedValueOnce({ responseId: 'generated-older', content }),
        generateImage: jest
          .fn()
          .mockResolvedValue(
            Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=',
              'base64',
            ),
          ),
      };
      const s3 = {
        upload: jest.fn().mockResolvedValue('https://s3.example.com/older.png'),
        delete: jest.fn().mockResolvedValue(undefined),
      };
      const instance = createLessonStudio(
        repo as unknown as AiLessonsRepository,
        llm as LessonLlmProviderContract,
        s3 as unknown as AwsS3Service,
        {} as DocxExporterService,
        {} as PdfLibreOfficeService,
        weekMaterials as unknown as WeekMaterialsPageCreateService,
        weekMaterialsGet as unknown as WeekMaterialsPageGetService,
        {
          effective: jest.fn().mockResolvedValue(''),
        } as unknown as AdminLessonPromptService,
        config,
        media,
      );
      repo.findLessonById
        .mockResolvedValueOnce(lesson)
        .mockResolvedValue(refreshed);
      repo.findLessonByIdForUpdate.mockResolvedValue(locked);
      const target = instance.generation as unknown as {
        executeStageGeneration: (
          id: string,
          dto: { stage: LessonStageType },
          userId: string,
          token: string,
        ) => Promise<void>;
      };

      await target.executeStageGeneration(
        lesson.id,
        { stage: LessonStageType.MEDITATION_OLDER },
        'producer',
        attemptToken,
      );

      expect(repo.saveVersion).toHaveBeenCalledTimes(1);
      const stage = locked.stages.find(
        (item) => item.type === LessonStageType.MEDITATION_OLDER,
      )!;
      expect(stage.status).toBe(LessonStageStatus.DRAFT);
      expect(stage.failureCode).toBeNull();
      expect(s3.delete).not.toHaveBeenCalled();
      expect(repo.findLessonById).toHaveBeenLastCalledWith(
        lesson.id,
        expect.any(Object),
      );
    },
  );

  it('T-B06: executeStageGeneration aborta commit com UPSTREAM_CHANGED se upstream mudou durante a geração', async () => {
    const stage0 = {
      id: 'stage-0',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.PRODUCER_APPROVED,
      currentVersionId: 'v0',
      versions: [{ id: 'v0', structuredDataJson: { story: 'História' } }],
    };
    const stage1 = {
      id: 'stage-1',
      type: LessonStageType.LESSON_VISUALS,
      status: LessonStageStatus.PRODUCER_APPROVED,
      currentVersionId: 'v1',
      versions: [{ id: 'v1', structuredDataJson: { assets: [{ id: '1' }] } }],
    };
    const stage2 = {
      id: 'stage-2',
      lessonId: 'lesson-upstream',
      type: LessonStageType.STANDARD_GAME,
      status: LessonStageStatus.GENERATING,
      generationLeaseOwner: 'worker-me:uuid-123',
      generationRequestJson: {
        stage: LessonStageType.STANDARD_GAME,
        theme: 'Tema',
        weekNumber: 1,
        biblicalReference: 'Gênesis 1',
        upstreamChecksum: 'old-upstream-checksum-999',
      },
      generationRequestedById: 'user-1',
      versions: [],
      failureCode: null as string | null,
    };
    const lesson = {
      id: 'lesson-upstream',
      theme: 'Tema',
      weekNumber: 1,
      biblicalReference: 'Gênesis 1',
      status: LessonStatus.IN_PROGRESS,
      stages: [stage0, stage1, stage2],
    } as unknown as LessonEntity;

    const testService = createLessonStudio(
      repo as unknown as AiLessonsRepository,
      {
        generateStage: jest.fn().mockResolvedValue({
          responseId: 'resp-1',
          content: {
            name: 'Brincadeira Inovadora',
            objective: 'Objetivo da brincadeira',
            funMechanics: 'Mecânica dinâmica',
            materials: ['Bola'],
            preparation: ['Organizar roda'],
            steps: ['Forme uma roda.'],
            assets: [
              {
                id: 'compilado-01',
                purpose: 'Resumo',
                prompt: 'Infográfico',
                altText: 'Resumo',
              },
            ],
          },
        }),
        generateImage: jest
          .fn()
          .mockResolvedValue(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          ),
      } as unknown as LessonLlmProviderContract,
      {
        upload: jest
          .fn()
          .mockResolvedValue('https://s3.example.com/game-step-1.png'),
        delete: jest.fn().mockResolvedValue(undefined),
      } as unknown as AwsS3Service,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      weekMaterialsGet as unknown as WeekMaterialsPageGetService,
      {
        effective: jest.fn().mockResolvedValue(''),
      } as unknown as AdminLessonPromptService,
      config,
      media,
    );

    repo.findLessonById.mockResolvedValue(lesson);
    const lockedLesson = {
      ...lesson,
      stages: [
        {
          ...stage0,
          versions: [
            { id: 'v0', structuredDataJson: { story: 'História ALTERADA' } },
          ],
        },
        stage1,
        stage2,
      ],
    };
    repo.findLessonByIdForUpdate.mockResolvedValue(lockedLesson);
    repo.findLessonById
      .mockResolvedValueOnce(lesson)
      .mockResolvedValue(lockedLesson);

    const target = testService.generation as unknown as {
      executeStageGeneration: (
        id: string,
        dto: unknown,
        userId: string,
        attemptToken: string,
      ) => Promise<void>;
    };

    await target.executeStageGeneration(
      stage2.lessonId,
      stage2.generationRequestJson,
      stage2.generationRequestedById,
      'worker-me:uuid-123',
    );

    expect(stage2.status).toBe(LessonStageStatus.FAILED);
    expect(stage2.failureCode).toBe('UPSTREAM_CHANGED');
    expect(repo.saveVersion).not.toHaveBeenCalled();
  });

  it('T-B08: publishToWeekMaterial recupera página já existente pela tag de origem sem recriar', async () => {
    const lesson = {
      id: 'lesson-recover',
      status: LessonStatus.PUBLISHING,
      weekMaterialId: null,
      stages: Object.values(LessonStageType).map((type) => ({
        type,
        status: LessonStageStatus.APPROVED,
        currentVersionId: `v-${type}`,
      })),
    } as unknown as LessonEntity;

    weekMaterialsGet.findAllPaginated.mockResolvedValueOnce({
      data: [
        {
          id: 'existing-page-id-99',
          title: 'Semana 1',
          description: 'Material completo. [origem:licao:lesson-recover]',
        },
      ],
      total: 1,
    });

    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);
    repo.findLessonById.mockResolvedValue(lesson);

    const result = await service.publishToWeekMaterial('lesson-recover');

    expect(result.weekMaterialId).toBe('existing-page-id-99');
    expect(lesson.status).toBe(LessonStatus.PUBLISHED);
    expect(weekMaterials.createWeekMaterialsPage).not.toHaveBeenCalled();
  });

  it('T-B13: delete rejeita com ConflictException se alguma etapa estiver em GENERATING', async () => {
    const stage = {
      id: 'stage-1',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.GENERATING,
      versions: [],
    };
    const lesson = {
      id: 'lesson-del',
      status: LessonStatus.IN_PROGRESS,
      stages: [stage],
    } as unknown as LessonEntity;

    repo.findLessonById.mockResolvedValue(lesson);
    repo.removeLesson = jest.fn();

    await expect(service.delete('lesson-del')).rejects.toThrow(
      AppConflictException,
    );
    expect(repo.removeLesson).not.toHaveBeenCalled();
  });

  it('sincroniza story, memoryVerse e applicationAndAppeal ao salvar conteúdo editado da LESSON e rejeita edição durante GENERATING', async () => {
    const stage1 = {
      id: 'stage-lesson',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.DRAFT,
      lockVersion: 1,
      currentVersionId: 'v-1',
      versions: [
        {
          id: 'v-1',
          versionNumber: 1,
          structuredDataJson: {
            title: 'LIÇÃO: TEMA ORIGINAL',
            story: 'Narrativa original.',
            memoryVerse: {
              text: 'Versículo original.',
              reference: 'João 3:16',
              version: 'NVI',
            },
            applicationAndAppeal: 'Aplicação original.',
          },
        },
      ],
    };
    const stage2 = {
      id: 'stage-visuals',
      type: LessonStageType.LESSON_VISUALS,
      status: LessonStageStatus.GENERATING,
      lockVersion: 1,
      currentVersionId: null,
      versions: [],
    };
    const lesson = {
      id: 'lesson-sync',
      status: LessonStatus.IN_PROGRESS,
      stages: [stage1, stage2],
    } as unknown as LessonEntity;

    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);
    repo.findLessonById.mockResolvedValue(lesson);

    await expect(
      service.saveContent(
        'lesson-sync',
        {
          stage: LessonStageType.LESSON,
          lockVersion: 1,
          tiptapAstJson: { type: 'doc', content: [] },
        },
        'producer-1',
      ),
    ).rejects.toThrow(AppConflictException);

    stage2.status = LessonStageStatus.NOT_STARTED;
    repo.saveVersion.mockImplementation((v: Record<string, unknown>) => {
      const saved = { ...v, id: 'v-2' };
      stage1.versions.push(saved as never);
      return Promise.resolve(saved);
    });

    await service.saveContent(
      'lesson-sync',
      {
        stage: LessonStageType.LESSON,
        lockVersion: 1,
        tiptapAstJson: {
          type: 'doc',
          content: [
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'VERSÍCULO PARA MEMORIZAR' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: '“O Senhor é o meu pastor.”' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Salmos 23:1 — NVI' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'LIÇÃO BÍBLICA' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Narrativa editada completa.' }],
            },
            {
              type: 'heading',
              attrs: { level: 2 },
              content: [{ type: 'text', text: 'APLICAÇÃO E APELO' }],
            },
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Aplicação editada.' }],
            },
          ],
        },
      },
      'producer-1',
    );

    const latest = stage1.versions[stage1.versions.length - 1]
      .structuredDataJson as Record<string, unknown>;
    expect(latest.story).toBe('Narrativa editada completa.');
    expect(latest.applicationAndAppeal).toBe('Aplicação editada.');
    expect(latest.memoryVerse).toEqual({
      text: 'O Senhor é o meu pastor.',
      reference: 'Salmos 23:1',
      version: 'NVI',
    });
  });

  it('rejeita approveStage, requestChanges, completeProductionStage e previewStagePdf quando lockVersion ou currentVersionId divergem', async () => {
    const stage = {
      id: 'stage-review',
      type: LessonStageType.LESSON,
      status: LessonStageStatus.IN_REVIEW,
      lockVersion: 2,
      currentVersionId: 'v-2',
      versions: [
        {
          id: 'v-2',
          versionNumber: 2,
          structuredDataJson: {
            story: 'Narrativa válida.',
            memoryVerse: {
              text: 'Deus é amor.',
              reference: '1 João 4:8',
              version: 'NVI',
            },
          },
        },
      ],
    };
    const lesson = {
      id: 'lesson-lock-check',
      weekNumber: 1,
      status: LessonStatus.IN_REVIEW,
      stages: [stage],
    } as unknown as LessonEntity;

    repo.findLessonByIdForUpdate.mockResolvedValue(lesson);
    repo.findLessonById.mockResolvedValue(lesson);

    await expect(
      service.approveStage(
        'lesson-lock-check',
        LessonStageType.LESSON,
        'rev-1',
        1,
      ),
    ).rejects.toThrow(AppConflictException);

    await expect(
      service.requestChanges(
        'lesson-lock-check',
        LessonStageType.LESSON,
        'Ajustar texto',
        'rev-1',
        1,
      ),
    ).rejects.toThrow(AppConflictException);

    await expect(
      service.previewStagePdf(
        'lesson-lock-check',
        LessonStageType.LESSON,
        1,
        'v-2',
      ),
    ).rejects.toThrow(AppConflictException);

    await expect(
      service.previewStagePdf(
        'lesson-lock-check',
        LessonStageType.LESSON,
        2,
        'v-old',
      ),
    ).rejects.toThrow(AppConflictException);

    stage.status = LessonStageStatus.DRAFT;
    lesson.status = LessonStatus.IN_PROGRESS;
    await expect(
      service.completeProductionStage(
        'lesson-lock-check',
        LessonStageType.LESSON,
        1,
      ),
    ).rejects.toThrow(AppConflictException);
  });

  it('exclui no S3 apenas assets pertencentes à própria lição e ignora URLs arbitrárias injetadas no JSON', async () => {
    const ownedUrl =
      'https://studio-bucket.s3.us-east-1.amazonaws.com/test/uploads/1762700000000_ab12cd34_lesson-own-1-LESSON_VISUALS-visual-01.png';
    const foreignUrl =
      'https://studio-bucket.s3.us-east-1.amazonaws.com/shared-site-banner.png';
    const deletedUrls: string[] = [];

    const localService = createLessonStudio(
      repo as unknown as AiLessonsRepository,
      {} as LessonLlmProviderContract,
      {
        delete: jest.fn((url: string) => {
          deletedUrls.push(url);
          return Promise.resolve();
        }),
      } as unknown as AwsS3Service,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      weekMaterialsGet as unknown as WeekMaterialsPageGetService,
      {} as AdminLessonPromptService,
      config,
      media,
    );

    const lesson = {
      id: 'lesson-own-1',
      status: LessonStatus.DRAFT,
      stages: [
        {
          id: 'stage-v',
          type: LessonStageType.LESSON_VISUALS,
          status: LessonStageStatus.DRAFT,
          versions: [
            {
              id: 'ver-1',
              docxS3Key: null,
              pdfS3Key: null,
              structuredDataJson: {
                note: foreignUrl,
                _ownedAssetUrls: [ownedUrl, foreignUrl],
                assets: [
                  { id: 'visual-01', url: ownedUrl },
                  { id: 'visual-02', url: foreignUrl },
                ],
              },
            },
          ],
        },
      ],
    } as unknown as LessonEntity;

    repo.findLessonById.mockResolvedValue(lesson);
    await localService.service.delete('lesson-own-1');

    expect(deletedUrls).toEqual([ownedUrl]);
  });
});
