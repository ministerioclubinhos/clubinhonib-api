import { LessonImagePurpose } from '../providers/lesson-llm.types';
import type {
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
} from '../providers/lesson-llm.types';
import { LESSON_TEMPLATES } from '../templates/lesson-templates';
import { ConflictException } from '@nestjs/common';
import { LessonDraftService } from './lesson-draft.service';
import { AiLessonsRepository } from '../repositories/ai-lessons.repository';
import { LessonEntity } from '../entities/lesson.entity';
import { LessonCommentEntity } from '../entities/lesson-comment.entity';
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
    createComment: jest.fn((value: Partial<LessonCommentEntity>) => value),
    saveComment: jest.fn(),
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
    const instance = new LessonDraftService(
      repo as unknown as AiLessonsRepository,
      { generateStage } as unknown as LessonLlmProviderContract,
      {} as AwsS3Service,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      {} as AdminLessonPromptService,
    );
    const target = instance as unknown as {
      correctStoryVisuals: (
        lesson: LessonEntity,
        input: LessonLlmGenerationInput,
        generated: LessonLlmGenerationResult,
      ) => Promise<LessonLlmGenerationResult>;
    };
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
        target.correctStoryVisuals(lesson, input, invalid),
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
      target.correctStoryVisuals(lesson, input, valid),
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
      target.correctStoryVisuals(lesson, input, wrongQuantity),
    ).rejects.toThrow('exatamente 2');
    expect(generateStage).toHaveBeenCalledTimes(2);

    generateStage
      .mockClear()
      .mockRejectedValue(new Error('Provider unavailable'));
    await expect(
      target.correctStoryVisuals(lesson, input, wrongQuantity),
    ).rejects.toThrow('Provider unavailable');
    expect(generateStage).toHaveBeenCalledTimes(1);
    generateStage.mockClear();
    await expect(
      target.correctStoryVisuals(
        { stages: [] } as unknown as LessonEntity,
        input,
        valid,
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
    const target = new LessonDraftService(
      repo as unknown as AiLessonsRepository,
      { generateImage } as unknown as LessonLlmProviderContract,
      {
        upload: jest.fn().mockResolvedValue('https://example.test/manual.png'),
      } as unknown as AwsS3Service,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      {} as AdminLessonPromptService,
    ) as unknown as {
      generateAndStoreAssets: (
        id: string,
        type: LessonStageType,
        lesson: LessonEntity,
        content: Record<string, unknown>,
        uploaded: string[],
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const instance = new LessonDraftService(
      localRepo as unknown as AiLessonsRepository,
      {} as LessonLlmProviderContract,
      {} as AwsS3Service,
      {} as DocxExporterService,
      {} as PdfLibreOfficeService,
      weekMaterials as unknown as WeekMaterialsPageCreateService,
      {} as AdminLessonPromptService,
    );
    await instance.saveContent(
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
      const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
      .spyOn(service, 'previewStagePdf')
      .mockImplementation((_id, type) =>
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
      .spyOn(service, 'previewStagePdf')
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
      expect(repo.saveLesson).toHaveBeenCalledTimes(2);
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
    } as unknown as LessonEntity);
    await expect(
      service.publishToWeekMaterial('lesson-1'),
    ).rejects.toBeInstanceOf(ConflictException);
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
    ).rejects.toBeInstanceOf(ConflictException);
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
      const target = service as unknown as {
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
    const target = service as unknown as {
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

  it('exige um visual instrucional para cada passo da fixação do versículo', () => {
    const target = service as unknown as {
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
        name: 'Trilha da Alegria!',
        funMechanics: ['busca', 'movimento'],
      }),
    ).toBe(false);
  });

  it('rejeita nome ou dinâmica reutilizados de qualquer versão anterior', () => {
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
    const target = service as unknown as {
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
