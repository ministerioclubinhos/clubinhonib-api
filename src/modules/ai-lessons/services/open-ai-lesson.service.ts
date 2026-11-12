import type { LessonStructuredRequest } from '../types/lesson-image-brief.types';
import { providerTextTimeoutMs } from '../utils/provider-timeout.utils';
import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
import { AiRequestQueueService } from 'src/shared/providers/ai-queue/ai-request-queue.service';
import { AiQueueFeature } from 'src/shared/providers/ai-queue/enums';
import { lessonImageContextPrompt } from '../utils/lesson-image-context.utils';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';
import {
  imageConnectionErrorCode,
  retryImageConnection,
} from '../utils/image-request.utils';
import {
  OLDER_MEDITATION_ACTIVITY_SCHEMA,
  OLDER_MEDITATION_REVIEW_SCHEMA,
} from '../constants/older-meditation-contract.constants';
import { lessonImageTextPolicy } from '../utils/meditation-image.utils';
import { retryOlderMeditationRequest } from '../utils/older-meditation-request.utils';
import { OLDER_MEDITATION_REQUEST } from '../constants/older-meditation-request.constants';
import {
  LESSON_REVIEW_QUESTION_MIN,
  LESSON_REVIEW_QUESTION_MAX,
  LESSON_INTERNAL_FIELD_DESCRIPTIONS,
} from '../constants/lesson-editorial.constants';
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LessonProviderConfig } from '../providers/lesson-llm.types';
import { AxiosError } from 'axios';
import {
  openAiReasoningEffort,
  supportsOpenAiReasoning,
} from '../utils/openai-model-capabilities.utils';
import {
  buildLessonSystemPrompt,
  buildLessonUserPayload,
  lessonOperationLabel,
} from '../utils/lesson-system-prompt.utils';
import { decodeProviderImage } from '../utils/provider-image.utils';
import {
  DEFAULT_OPENAI_IMAGE_MODEL,
  DEFAULT_OPENAI_IMAGE_QUALITY,
  DEFAULT_OPENAI_TEXT_MODEL,
  LESSON_GAME_MAX_STEPS,
} from '../constants/ai-provider-settings.constants';
import {
  LessonImageOrientation,
  OPENAI_API,
  OPENAI_MAX_OUTPUT_TOKENS,
  PROVIDER_REQUEST,
  PROVIDER_TIMEOUT_FAILURE_CODE,
  PROVIDER_TIMEOUT_NETWORK_CODES,
} from '../providers/lesson-llm.constants';
import {
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
  LessonImageReference,
  LessonImageContext,
  LessonImagePurpose,
  LessonLlmProviderContract,
} from '../providers/lesson-llm.types';

type ResponsesPayload = {
  id?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  incomplete_details?: { reason?: string };
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};
const STRING_ARRAY = { type: 'array', items: { type: 'string' } } as const;
/** One paid image is generated per step: the ceiling bounds cost. */
const GAME_STEPS_SCHEMA = {
  type: 'array',
  minItems: 1,
  maxItems: LESSON_GAME_MAX_STEPS,
  items: { type: 'string' },
} as const;
const ASSET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'purpose', 'prompt', 'altText'],
  properties: {
    id: { type: 'string' },
    purpose: { type: 'string' },
    prompt: { type: 'string' },
    altText: { type: 'string' },
  },
} as const;
const STORY_VISUAL_ASSET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'sourceExcerpt', 'purpose', 'prompt', 'altText'],
  properties: {
    id: {
      type: 'string',
      description:
        'ID sequencial no formato visual-01, visual-02 e assim por diante.',
    },
    sourceExcerpt: {
      type: 'string',
      description:
        'Trecho literal, contínuo e não sobreposto da LIÇÃO BÍBLICA atribuído a esta imagem.',
    },
    purpose: { type: 'string' },
    prompt: { type: 'string' },
    altText: { type: 'string' },
  },
} as const;
const CUTOUT_CATEGORY_VALUES = [
  'CHARACTERS',
  'ANIMALS',
  'BUILDINGS',
  'SCENERY',
  'SKY_AND_NATURE',
  'OBJECTS',
];
const CUTOUT_KIT_ASSET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'id',
    'category',
    'title',
    'items',
    'layoutPlan',
    'prompt',
    'altText',
  ],
  properties: {
    id: {
      type: 'string',
      description:
        'ID sequencial no formato kit-01, kit-02 e assim por diante.',
    },
    category: { type: 'string', enum: CUTOUT_CATEGORY_VALUES },
    title: { type: 'string' },
    items: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'label',
          'description',
          'category',
          'storyEvidence',
          'variantOf',
          'extra',
          'size',
        ],
        properties: {
          label: {
            type: 'string',
            description: 'Legenda curta aplicada pelo renderer sob o elemento.',
          },
          description: { type: 'string' },
          category: { type: 'string', enum: CUTOUT_CATEGORY_VALUES },
          storyEvidence: {
            type: 'string',
            description:
              'Trecho literal da LIÇÃO BÍBLICA que justifica o elemento (vazio só para itens neutros de SKY_AND_NATURE ou extras).',
          },
          variantOf: { type: ['string', 'null'] },
          extra: { type: 'boolean' },
          size: { type: 'string', enum: ['LARGE', 'MEDIUM', 'SMALL'] },
        },
      },
    },
    layoutPlan: {
      type: 'string',
      description:
        'Como os elementos se organizam na prancha e por que cabem sem encolher.',
    },
    prompt: { type: 'string' },
    altText: { type: 'string' },
  },
} as const;
const CUTOUT_KIT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['assets', 'coverageChecklist'],
  properties: {
    assets: {
      type: 'array',
      minItems: 4,
      maxItems: 10,
      items: CUTOUT_KIT_ASSET_SCHEMA,
    },
    coverageChecklist: {
      type: 'array',
      minItems: 6,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'status', 'justification'],
        properties: {
          category: { type: 'string', enum: CUTOUT_CATEGORY_VALUES },
          status: { type: 'string', enum: ['COVERED', 'NOT_APPLICABLE'] },
          justification: { type: 'string' },
        },
      },
    },
  },
} as const;
const GAME_INSTRUCTION_ASSET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'stepNumber', 'instruction', 'purpose', 'prompt', 'altText'],
  properties: {
    id: { type: 'string' },
    stepNumber: { type: 'integer' },
    instruction: {
      type: 'string',
      description:
        'Cópia literal do passo da brincadeira ilustrado por esta imagem.',
    },
    purpose: { type: 'string' },
    prompt: { type: 'string' },
    altText: { type: 'string' },
  },
} as const;
const FIXATION_ASSET_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'purpose', 'prompt', 'altText', 'displayText'],
  properties: {
    id: { type: 'string' },
    purpose: { type: 'string' },
    prompt: { type: 'string' },
    altText: { type: 'string' },
    displayText: {
      type: 'string',
      description:
        'Trecho exato da NVI que a própria imagem gerada deve exibir como cartão final; o servidor recompõe este campo a partir do versículo aprovado.',
    },
  },
} as const;

export function schemaFor(
  stage: LessonStageType,
  reviewOlder = false,
  category: LessonCategory = LessonCategory.REGULAR,
): Record<string, unknown> {
  if (stage === LessonStageType.MEDITATION_OLDER && reviewOlder)
    return OLDER_MEDITATION_REVIEW_SCHEMA;
  if (stage === LessonStageType.LESSON)
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'biblicalReference',
        'centralMessage',
        'purpose',
        'songs',
        'verseChoice',
        'memoryVerse',
        'principleExplanation',
        'story',
        'applicationAndAppeal',
        'counseling',
        'reviewQuestions',
        'closingPrayer',
        'visualScenes',
        'reviewerNotes',
      ],
      properties: {
        title: { type: 'string' },
        biblicalReference: { type: 'string' },
        // Internal fields: generated before the sections they steer, never published.
        centralMessage: {
          type: 'string',
          description: LESSON_INTERNAL_FIELD_DESCRIPTIONS.centralMessage,
        },
        purpose: { type: 'string' },
        songs: STRING_ARRAY,
        verseChoice: {
          type: 'string',
          description: LESSON_INTERNAL_FIELD_DESCRIPTIONS.verseChoice,
        },
        memoryVerse: {
          type: 'object',
          additionalProperties: false,
          required: ['text', 'reference', 'version'],
          properties: {
            text: { type: 'string' },
            reference: { type: 'string' },
            version: { type: 'string' },
          },
        },
        principleExplanation: { type: 'string' },
        story: {
          type: 'string',
          description:
            category === LessonCategory.SPECIAL
              ? 'História contemporânea ilustrativa ou panorama bíblico, com cenas/cartazes, dicas participativas e conexão explícita às Escrituras, sem confundir ficção com fatos bíblicos.'
              : 'Aula completa e participativa, de 900 a 1.400 palavras, com pelo menos quatro parágrafos por relato, acontecimento central e desfecho de todos os relatos antes da aplicação, sem falas interrompidas, descrições de arte, marcadores de cena ou Markdown.',
        },
        applicationAndAppeal: { type: 'string' },
        counseling: { type: 'string' },
        closingPrayer: {
          type: 'string',
          description:
            category === LessonCategory.SPECIAL
              ? 'Oração curta, voluntária, em linguagem infantil e ligada ao tema.'
              : 'Vazio salvo solicitação explícita de oração final separada.',
        },
        reviewQuestions: {
          type: 'array',
          minItems: LESSON_REVIEW_QUESTION_MIN,
          maxItems: LESSON_REVIEW_QUESTION_MAX,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['question', 'answer'],
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
            },
          },
        },
        visualScenes: { type: 'array', minItems: 3, items: ASSET_SCHEMA },
        reviewerNotes: {
          type: 'string',
          description: LESSON_INTERNAL_FIELD_DESCRIPTIONS.reviewerNotes,
        },
      },
    };
  if (
    stage === LessonStageType.LESSON_VISUALS &&
    category !== LessonCategory.SPECIAL
  )
    return CUTOUT_KIT_SCHEMA;
  if (stage === LessonStageType.LESSON_VISUALS)
    return {
      type: 'object',
      additionalProperties: false,
      required: ['assets'],
      properties: {
        assets: {
          type: 'array',
          minItems: 4,
          maxItems: 10,
          items: STORY_VISUAL_ASSET_SCHEMA,
        },
      },
    };
  if (stage === LessonStageType.STANDARD_GAME)
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'name',
        'objective',
        'funMechanics',
        'materials',
        'preparation',
        'steps',
        'rulesAndSafety',
        'ageAdaptations',
        'biblicalPrinciple',
        'assets',
      ],
      properties: {
        name: { type: 'string' },
        objective: { type: 'string' },
        funMechanics: {
          type: 'array',
          minItems: 2,
          maxItems: 3,
          items: { type: 'string' },
        },
        materials: STRING_ARRAY,
        preparation: { type: 'string' },
        steps: GAME_STEPS_SCHEMA,
        rulesAndSafety: STRING_ARRAY,
        ageAdaptations: {
          type: 'object',
          additionalProperties: false,
          required: ['ages5To7', 'ages8To11'],
          properties: {
            ages5To7: { type: 'string' },
            ages8To11: { type: 'string' },
          },
        },
        biblicalPrinciple: { type: 'string' },
        assets: {
          type: 'array',
          minItems: 1,
          maxItems: LESSON_GAME_MAX_STEPS,
          items: GAME_INSTRUCTION_ASSET_SCHEMA,
        },
      },
    };
  if (stage === LessonStageType.VERSE_VISUALS)
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'verseText',
        'verseReference',
        'verseVersion',
        'splitRationale',
        'printableAssets',
      ],
      properties: {
        title: { type: 'string' },
        verseText: { type: 'string' },
        verseReference: { type: 'string' },
        verseVersion: { type: 'string', enum: ['NVI'] },
        splitRationale: { type: 'string' },
        printableAssets: {
          type: 'array',
          minItems: 2,
          maxItems: 10,
          items: FIXATION_ASSET_SCHEMA,
        },
      },
    };
  if (stage === LessonStageType.VERSE_FIXATION)
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'name',
        'objective',
        'funMechanics',
        'verseText',
        'verseReference',
        'verseVersion',
        'materials',
        'preparation',
        'steps',
        'ageAdaptations',
        'rulesAndSafety',
        'evaluation',
        'biblicalPrinciple',
        'assets',
      ],
      properties: {
        name: { type: 'string' },
        objective: { type: 'string' },
        funMechanics: {
          type: 'array',
          minItems: 2,
          maxItems: 3,
          items: { type: 'string' },
        },
        verseText: { type: 'string' },
        verseReference: { type: 'string' },
        verseVersion: { type: 'string', enum: ['NVI'] },
        materials: STRING_ARRAY,
        preparation: { type: 'string' },
        steps: GAME_STEPS_SCHEMA,
        ageAdaptations: {
          type: 'object',
          additionalProperties: false,
          required: ['ages5To7', 'ages8To11'],
          properties: {
            ages5To7: { type: 'string' },
            ages8To11: { type: 'string' },
          },
        },
        rulesAndSafety: STRING_ARRAY,
        evaluation: { type: 'string' },
        biblicalPrinciple: { type: 'string' },
        assets: {
          type: 'array',
          minItems: 1,
          maxItems: LESSON_GAME_MAX_STEPS,
          items: GAME_INSTRUCTION_ASSET_SCHEMA,
        },
      },
    };
  const activity = {
    type: 'object',
    additionalProperties: false,
    required: ['number', 'instruction', 'answer'],
    properties: {
      number: { type: 'integer' },
      instruction: { type: 'string' },
      answer: { type: 'string' },
    },
  } as const;
  if (
    stage === LessonStageType.MEDITATION_YOUNGER ||
    stage === LessonStageType.MEDITATION_OLDER
  ) {
    const count = stage === LessonStageType.MEDITATION_YOUNGER ? 2 : 3;
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'ageGroup',
        'verseText',
        'verseReference',
        'verseVersion',
        'biblicalText',
        'introduction',
        'activities',
        'prayer',
        'printableAssets',
      ],
      properties: {
        title: { type: 'string' },
        ageGroup: { type: 'string' },
        verseText: { type: 'string' },
        verseReference: { type: 'string' },
        verseVersion: { type: 'string', enum: ['NVI'] },
        biblicalText: { type: 'string' },
        introduction: { type: 'string' },
        activities: {
          type: 'array',
          minItems: count,
          maxItems: count,
          items:
            stage === LessonStageType.MEDITATION_OLDER
              ? OLDER_MEDITATION_ACTIVITY_SCHEMA
              : activity,
        },
        prayer: { type: 'string' },
        printableAssets: {
          type: 'array',
          minItems: stage === LessonStageType.MEDITATION_YOUNGER ? 1 : 0,
          maxItems: count,
          description:
            stage === LessonStageType.MEDITATION_OLDER
              ? 'Exatamente uma arte por atividade (ids 1, 2 e 3), como anexo ou apoio visual da questão, sem expor a resposta nem duplicar o enunciado.'
              : 'Artes das atividades, com ids correspondentes aos números das atividades.',
          items: {
            ...ASSET_SCHEMA,
            properties: {
              ...ASSET_SCHEMA.properties,
              id: {
                type: 'string',
                enum: Array.from({ length: count }, (_, index) =>
                  String(index + 1),
                ),
              },
            },
          },
        },
      },
    };
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: [
      'title',
      'instruction',
      'verseText',
      'verseReference',
      'verseVersion',
      'printLayout',
      'printableAssets',
    ],
    properties: {
      title: { type: 'string' },
      instruction: { type: 'string' },
      verseText: { type: 'string' },
      verseReference: { type: 'string' },
      verseVersion: { type: 'string', enum: ['NVI'] },
      printLayout: { type: 'string', enum: ['TWO_COPIES_A4_PORTRAIT'] },
      printableAssets: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
        items: ASSET_SCHEMA,
      },
    },
  };
}

@Injectable()
export class OpenAiLessonService implements LessonLlmProviderContract {
  private readonly logger = new Logger(OpenAiLessonService.name);

  constructor(
    private readonly config: LessonProviderConfig,
    private readonly queue: AiRequestQueueService,
  ) {}

  async generateStage(
    input: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey)
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY não configurada; nenhuma minuta simulada foi criada.',
      );

    const model =
      this.config.get<string>('OPENAI_TEXT_MODEL') || DEFAULT_OPENAI_TEXT_MODEL;
    const reasoning = supportsOpenAiReasoning(model);
    const reasoningEffort = openAiReasoningEffort(
      model,
      this.config.get<string>('OPENAI_REASONING_EFFORT'),
    );
    this.logger.log(
      `[OpenAI Request] Geração de etapa '${input.stage}' | Operação: ${lessonOperationLabel(input)} | Modelo: ${model} | Semana: ${input.weekNumber}`,
    );
    const startTime = Date.now();

    const system = buildLessonSystemPrompt(input);
    const user = buildLessonUserPayload(input);
    try {
      const request = () =>
        this.queue.post<ResponsesPayload>(
          OPENAI_API.responses,
          {
            model,
            store: false,
            ...(reasoning
              ? {}
              : { max_output_tokens: this.maxOutputTokens(input.stage) }),
            ...(reasoningEffort
              ? { reasoning: { effort: reasoningEffort } }
              : {}),
            input: [
              { role: 'system', content: system },
              {
                role: 'user',
                content: input.olderMeditationReview?.images.length
                  ? [
                      { type: 'input_text', text: user },
                      ...input.olderMeditationReview.images.flatMap(
                        ({ activityNumber, image }) => [
                          {
                            type: 'input_text',
                            text: `Imagem real do desafio ${activityNumber}`,
                          },
                          {
                            type: 'input_image',
                            image_url: `data:${image.mimeType};base64,${image.data.toString('base64')}`,
                            detail: 'high',
                          },
                        ],
                      ),
                    ]
                  : user,
              },
            ],
            text: {
              format: {
                type: 'json_schema',
                name:
                  input.structuredRequest?.name ??
                  `clubinho_${input.stage.toLowerCase()}`,
                strict: true,
                schema:
                  input.structuredRequest?.schema ??
                  schemaFor(
                    input.stage,
                    Boolean(input.olderMeditationReview),
                    input.category,
                  ),
              },
            },
          },
          {
            feature: AiQueueFeature.LESSONS,
            timeout: providerTextTimeoutMs(input.stage),
          },
        );
      // The same bounded 429 policy protects every stage, not only item 7.
      const response = await retryOlderMeditationRequest(request, (delay) =>
        this.logger.warn(
          `Limite temporário da OpenAI na etapa '${input.stage}'; nova tentativa em ${delay}ms.`,
        ),
      );
      if (response.data.incomplete_details)
        throw new BadGatewayException(
          `Resposta incompleta da OpenAI: ${response.data.incomplete_details.reason ?? 'sem motivo'}`,
        );
      const blocks =
        response.data.output?.flatMap((item) => item.content ?? []) ?? [];
      const refusal = blocks.find(
        (item) => item.type === OPENAI_API.refusalBlock || item.refusal,
      );
      if (refusal)
        throw new BadGatewayException(
          `OpenAI recusou a geração: ${JSON.stringify({ error: { code: 'content_blocked' } })}`,
        );
      const block = blocks.find(
        (item) => item.type === OPENAI_API.textBlock || item.text,
      );
      const raw = response.data.output_text ?? block?.text;
      if (!raw || !response.data.id)
        throw new BadGatewayException(
          'OpenAI retornou resposta sem conteúdo ou identificador.',
        );
      const elapsed = Date.now() - startTime;
      this.logger.log(
        `[OpenAI Response] Etapa '${input.stage}' gerada em ${elapsed}ms | Response ID: ${response.data.id}`,
      );
      return {
        content: this.parseStructured(raw),
        responseId: response.data.id,
        usage: {
          model,
          inputTokens: response.data.usage?.input_tokens,
          outputTokens: response.data.usage?.output_tokens,
          totalTokens: response.data.usage?.total_tokens,
        },
      };
    } catch (error: unknown) {
      if (error instanceof AiQueueException) throw error;
      const elapsed = Date.now() - startTime;
      if (error instanceof BadGatewayException) {
        this.logger.error(
          `[OpenAI Error] Etapa '${input.stage}' falhou em ${elapsed}ms: ${error.message}`,
        );
        throw error;
      }
      const detail = this.failureDetail(error);
      this.logger.error(
        `[OpenAI Error] Etapa '${input.stage}' falhou em ${elapsed}ms: ${detail}`,
      );
      throw new BadGatewayException(
        `Falha ao gerar ${input.stage} na OpenAI: ${detail}`,
      );
    }
  }

  generateStructured(
    request: LessonStructuredRequest,
    context: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult> {
    return this.generateStage({ ...context, structuredRequest: request });
  }

  private maxOutputTokens(stage: LessonStageType): number {
    if (stage === LessonStageType.MEDITATION_OLDER)
      return OLDER_MEDITATION_REQUEST.maxOutputTokens;
    return stage === LessonStageType.LESSON
      ? OPENAI_MAX_OUTPUT_TOKENS.lesson
      : OPENAI_MAX_OUTPUT_TOKENS.default;
  }

  private parseStructured(raw: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, unknown>;
    } catch {
      // Reported below with a stable message.
    }
    throw new BadGatewayException(
      'OpenAI retornou conteúdo estruturado inválido (JSON malformado).',
    );
  }

  /** Timeouts get a classifiable code; other failures keep the sanitized payload. */
  private failureDetail(error: unknown): string {
    if (!(error instanceof AxiosError)) return String(error).slice(0, 500);
    if (
      (PROVIDER_TIMEOUT_NETWORK_CODES as readonly string[]).includes(
        error.code ?? '',
      )
    )
      return JSON.stringify({
        error: { code: PROVIDER_TIMEOUT_FAILURE_CODE },
      });
    return JSON.stringify(error.response?.data ?? error.message).slice(0, 500);
  }

  async generateImage(
    prompt: string,
    orientation?: string,
    visualType?: string,
    identityReferenceImage?: LessonImageReference,
    purpose?: LessonImagePurpose,
    context?: LessonImageContext,
  ): Promise<Buffer> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey)
      throw new ServiceUnavailableException('OPENAI_API_KEY não configurada.');
    const model =
      this.config.get<string>('OPENAI_IMAGE_MODEL') ||
      DEFAULT_OPENAI_IMAGE_MODEL;
    const quality =
      this.config.get<string>('OPENAI_IMAGE_QUALITY') ||
      DEFAULT_OPENAI_IMAGE_QUALITY;
    this.logger.log(
      `[OpenAI Request] Geração de imagem | Modelo: ${model} | Orientação: ${orientation ?? 'PADRÃO'} | Tipo: ${visualType ?? 'PADRÃO'}`,
    );
    const startTime = Date.now();
    try {
      const finalPrompt =
        purpose === LessonImagePurpose.CUTOUT_SHEET
          ? `Prancha de elementos ilustrados para recortar, para crianças de 5 a 11 anos. Orientação obrigatória: ${orientation || 'definida no prompt'}. Sem conteúdo sexual, romântico, erotizado, violência gráfica ou debates de sexualidade. ${lessonImageTextPolicy(purpose)} ${prompt}`
          : `${lessonImageContextPrompt(context)} Para crianças de ${purpose === LessonImagePurpose.MEDITATION_ACTIVITY ? '4 a 11' : '5 a 11'} anos. Não acrescente personagens, fatos ou símbolos não pedidos. Estratégia pedagógica: ${visualType || 'definida no prompt'}. Orientação obrigatória: ${orientation || 'definida no prompt'}. Sem conteúdo sexual, romântico, erotizado, violência gráfica ou debates de sexualidade. Obedeça literalmente ao estilo, orientação, paleta, margem e finalidade pedidos a seguir. ${lessonImageTextPolicy(purpose)} ${prompt}`;
      const size =
        orientation === String(LessonImageOrientation.PORTRAIT)
          ? OPENAI_API.portraitSize
          : OPENAI_API.landscapeSize;
      const request = () =>
        identityReferenceImage
          ? (() => {
              const form = new FormData();
              form.append('model', model);
              form.append('prompt', finalPrompt);
              form.append('size', size);
              form.append('quality', quality);
              form.append('output_format', OPENAI_API.imageFormat);
              form.append(
                'image[]',
                new Blob([new Uint8Array(identityReferenceImage.data)], {
                  type: identityReferenceImage.mimeType,
                }),
                identityReferenceImage.mimeType === 'image/jpeg'
                  ? 'clubinho-identidade-visual.jpg'
                  : 'clubinho-identidade-visual.png',
              );
              for (const [index, companion] of (
                identityReferenceImage.companions ?? []
              ).entries())
                form.append(
                  'image[]',
                  new Blob([new Uint8Array(companion.data)], {
                    type: companion.mimeType,
                  }),
                  `clubinho-referencia-${index + 2}.${companion.mimeType === 'image/jpeg' ? 'jpg' : 'png'}`,
                );
              return this.queue.post<{ data?: Array<{ b64_json?: string }> }>(
                OPENAI_API.imageEdits,
                form,
                {
                  feature: AiQueueFeature.LESSONS,
                  timeout: PROVIDER_REQUEST.imageTimeoutMs,
                },
              );
            })()
          : this.queue.post<{ data?: Array<{ b64_json?: string }> }>(
              OPENAI_API.imageGenerations,
              {
                model,
                prompt: finalPrompt,
                size,
                quality,
                output_format: OPENAI_API.imageFormat,
              },
              {
                feature: AiQueueFeature.LESSONS,
                timeout: PROVIDER_REQUEST.imageTimeoutMs,
              },
            );
      const response = await retryImageConnection(request, (code) => {
        this.logger.warn(
          `[OpenAI Image] phase=connection-retry code=${code} attempt=2/2 model=${model}`,
        );
      });
      const encoded = response.data.data?.[0]?.b64_json;
      if (!encoded)
        throw new BadGatewayException(
          'OpenAI não retornou os bytes da imagem.',
        );
      const elapsed = Date.now() - startTime;
      this.logger.log(
        `[OpenAI Response] Imagem gerada em ${elapsed}ms | Tamanho: ${encoded.length} b64 chars`,
      );
      return decodeProviderImage(encoded);
    } catch (error: unknown) {
      if (error instanceof AiQueueException) throw error;
      const elapsed = Date.now() - startTime;
      const detail = this.failureDetail(error);
      this.logger.error(
        `[OpenAI Error] Geração de imagem falhou em ${elapsed}ms: ${detail}`,
      );
      if (error instanceof BadGatewayException) throw error;
      const connectionCode = imageConnectionErrorCode(error);
      throw new BadGatewayException(
        `Falha ao gerar imagem na OpenAI: ${connectionCode ? `[${connectionCode}] ` : ''}${detail}`,
      );
    }
  }
}
