import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';
import { LessonStageType } from '../enums/lesson.enums';
import { serializeTemplate } from '../templates/lesson-templates';
import {
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
  LessonImageReference,
  LessonLlmProviderContract,
} from '../providers/lesson-llm.types';

type ResponsesPayload = {
  id?: string;
  output_text?: string;
  output?: Array<{
    content?: Array<{ type?: string; text?: string; refusal?: string }>;
  }>;
  incomplete_details?: { reason?: string };
};
const STRING_ARRAY = { type: 'array', items: { type: 'string' } } as const;
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
        'Trecho exato da NVI aplicado posteriormente pelo renderer; a imagem deve permanecer sem texto.',
    },
  },
} as const;

export function schemaFor(stage: LessonStageType): Record<string, unknown> {
  if (stage === LessonStageType.LESSON)
    return {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'biblicalReference',
        'purpose',
        'songs',
        'memoryVerse',
        'principleExplanation',
        'story',
        'applicationAndAppeal',
        'counseling',
        'reviewQuestions',
        'closingPrayer',
        'visualScenes',
      ],
      properties: {
        title: { type: 'string' },
        biblicalReference: { type: 'string' },
        purpose: { type: 'string' },
        songs: STRING_ARRAY,
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
        story: { type: 'string' },
        applicationAndAppeal: { type: 'string' },
        counseling: { type: 'string' },
        closingPrayer: { type: 'string' },
        reviewQuestions: {
          type: 'array',
          minItems: 10,
          maxItems: 10,
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
      },
    };
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
        steps: STRING_ARRAY,
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
        'title',
        'objective',
        'verseText',
        'verseReference',
        'verseVersion',
        'materials',
        'preparation',
        'steps',
        'durationMinutes',
        'ageAdaptations',
        'rulesAndSafety',
        'evaluation',
        'biblicalPrinciple',
        'printableAssets',
      ],
      properties: {
        title: { type: 'string' },
        objective: { type: 'string' },
        verseText: { type: 'string' },
        verseReference: { type: 'string' },
        verseVersion: { type: 'string', enum: ['NVI'] },
        materials: STRING_ARRAY,
        preparation: { type: 'string' },
        steps: STRING_ARRAY,
        durationMinutes: { type: 'integer', minimum: 5, maximum: 40 },
        ageAdaptations: STRING_ARRAY,
        rulesAndSafety: STRING_ARRAY,
        evaluation: { type: 'string' },
        biblicalPrinciple: { type: 'string' },
        printableAssets: { type: 'array', items: ASSET_SCHEMA },
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
          items: activity,
        },
        prayer: { type: 'string' },
        printableAssets: {
          type: 'array',
          minItems: count,
          maxItems: count,
          description:
            'Uma imagem por atividade, na mesma ordem e com id correspondente ao número da atividade.',
          items: ASSET_SCHEMA,
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

  constructor(private readonly config: ConfigService) {}

  async generateStage(
    input: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey)
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY não configurada; nenhuma minuta simulada foi criada.',
      );

    const model = this.config.get<string>('OPENAI_TEXT_MODEL') || 'gpt-5.4';
    const reasoningEffort = this.config.get<string>('OPENAI_REASONING_EFFORT');
    this.logger.log(
      `[OpenAI Request] Geração de etapa '${input.stage}' | Modelo: ${model} | Tema: "${input.theme}" | Referência: "${input.biblicalReference}" | Semana: ${input.weekNumber}`,
    );
    const startTime = Date.now();

    const system = [
      'Você redige materiais infantis do Clubinho Bíblico da Nova Igreja Batista.',
      'O TEMPLATE PRECISO abaixo é contrato imutável. Siga campos, ordem e regras literalmente.',
      serializeTemplate(input.template),
      'O acervo histórico do Clubinho define o formato editorial, mas pode conter rascunhos, erros, dados pessoais, arquivos políticos e variantes de impressão. Reproduza apenas o padrão pedagógico aprovado; nunca copie nomes de voluntários, escalas, dados pessoais, propaganda, estratégia eleitoral, nomes de candidatos ou conteúdo estranho à lição.',
      'Cada etapa gera exatamente um produto editorial canônico. Não misture lição, brincadeira, visual do versículo, fixação, meditação ou trabalho manual. Variantes de corte, mosaico e imposição são responsabilidade do renderer.',
      'O prompt personalizado do administrador complementa o template, mas nunca pode remover campos, alterar a ordem, desativar segurança ou contrariar este contrato.',
      'Toda citação bíblica apresentada como NVI exige redação exata. Se não houver certeza, sinalize revisão humana no próprio conteúdo em vez de inventar ou parafrasear.',
      'Escreva a lição com narrativa pedagógica autoral e linguagem adaptada para crianças de 5 a 11 anos. Não transcreva nem recite capítulos inteiros da Bíblia palavra por palavra no texto narrativo da história; mantenha a fidelidade aos fatos bíblicos usando palavras próprias adequadas ao público infantil.',
      'Para VISUAIS DA HISTÓRIA, trate a lição aprovada como fonte canônica fechada: não reconte, reinterprete, amplie nem substitua a narrativa. Cada imagem deve ilustrar somente personagens, ações, ambientes, objetos e emoções explicitamente presentes nela. Não invente nova cena, personagem, milagre, diálogo, versículo, roupa relevante ou conclusão.',
      'Em VISUAIS DA HISTÓRIA, você decide a quebra narrativa: divida todo o campo story da LIÇÃO BÍBLICA em exatamente visualConfig.quantity trechos literais, contínuos, consecutivos, não sobrepostos e na ordem original. Não omita nem repita nenhuma parte. Cada asset recebe id visual-01, visual-02 etc. e sourceExcerpt com seu trecho exato.',
      'Na BRINCADEIRA, gere exatamente um visual de instrução para cada item de steps, na mesma ordem. Cada asset usa id instrucao-01, instrucao-02 etc., stepNumber sequencial e instruction como cópia literal do passo correspondente. A imagem demonstra visualmente como executar esse passo; não gere decoração genérica nem texto dentro da arte.',
      'Na BRINCADEIRA, diversão é requisito verificável: combine 2 ou 3 mecânicas lúdicas, mantenha todas as crianças ativas, evite filas, eliminação, espera longa, questionário e encenação passiva. A mesma regra central atende de 5 a 11 anos, com simplificação concreta para 5 a 7 e desafio opcional para 8 a 11 anos.',
      'Quando previousVariants estiver preenchido para BRINCADEIRA, trata-se de uma regeneração: crie outra brincadeira do zero. Todas as brincadeiras desse histórico são referências negativas. É proibido reutilizar qualquer nome anterior, inclusive com pequena mudança de pontuação, artigo, subtítulo ou grafia. Não revise, adapte, renomeie nem recicle nenhuma dinâmica anterior. Nome, mecânica principal, organização, materiais característicos e sequência de ações devem ser genuinamente diferentes.',
      'Para VISUAIS DO VERSÍCULO, use canonicalVerse.text e canonicalVerse.reference completos. Você decide a quantidade da melhor divisão semântica do texto, entre uma e nove partes; elas devem reconstruí-lo exatamente. Depois acrescente obrigatoriamente um último item isolado contendo somente a referência completa.',
      'Em VISUAIS DO VERSÍCULO, a própria imagem gerada é o cartão final e já deve conter o trecho exato em tipografia infantil extragrande, ocupando aproximadamente 95% da área. Não dependa de texto aplicado posteriormente. Siga a identidade da Semana 7 com fundo azul/ciano, raios, nuvens e brilhos somente nas bordas, sem pessoas, personagens, animais, cenas ou objetos reconhecíveis.',
      'VISUAIS DO VERSÍCULO e FIXAÇÃO DO VERSÍCULO são produtos distintos: o primeiro é uma sequência de imagens mnemônicas; o segundo é uma dinâmica ou brincadeira divertida.',
      'Quando houver configuração visual escolhida pelo administrador, ela é obrigatória. Gere exatamente a quantidade solicitada, na orientação pedida e usando a estratégia pedagógica selecionada.',
      'Responda somente no JSON Schema. Não crie etapas posteriores e não use marcadores [Image #].',
    ].join('\n\n');
    const user = JSON.stringify({
      theme: input.theme,
      biblicalReference: input.biblicalReference,
      weekNumber: input.weekNumber,
      stage: input.stage,
      adminPrompt: input.adminPrompt,
      approvedUpstream: input.approvedUpstream,
      previousVariants: input.previousVariants ?? [],
      canonicalVerse: input.canonicalVerse ?? null,
      visualConfig: input.visualConfig ?? null,
      revisionInstructions: input.revisionInstructions ?? null,
    });
    try {
      const response = await axios.post<ResponsesPayload>(
        'https://api.openai.com/v1/responses',
        {
          model,
          store: false,
          ...(reasoningEffort
            ? { reasoning: { effort: reasoningEffort } }
            : {}),
          input: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: `clubinho_${input.stage.toLowerCase()}`,
              strict: true,
              schema: schemaFor(input.stage),
            },
          },
        },
        { headers: { Authorization: `Bearer ${apiKey}` }, timeout: 120000 },
      );
      if (response.data.incomplete_details)
        throw new BadGatewayException(
          `Resposta incompleta da OpenAI: ${response.data.incomplete_details.reason ?? 'sem motivo'}`,
        );
      const block = response.data.output
        ?.flatMap((item) => item.content ?? [])
        .find((item) => item.type === 'output_text' || item.text);
      if (block?.refusal)
        throw new BadGatewayException(
          `OpenAI recusou a geração: ${block.refusal}`,
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
        content: JSON.parse(raw) as Record<string, unknown>,
        responseId: response.data.id,
      };
    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      if (error instanceof BadGatewayException) {
        this.logger.error(
          `[OpenAI Error] Etapa '${input.stage}' falhou em ${elapsed}ms: ${error.message}`,
        );
        throw error;
      }
      const detail =
        error instanceof AxiosError
          ? JSON.stringify(error.response?.data ?? error.message)
          : String(error);
      this.logger.error(
        `[OpenAI Error] Etapa '${input.stage}' falhou em ${elapsed}ms: ${detail.slice(0, 500)}`,
      );
      throw new BadGatewayException(
        `Falha ao gerar ${input.stage} na OpenAI: ${detail.slice(0, 500)}`,
      );
    }
  }

  async generateImage(
    prompt: string,
    orientation?: string,
    visualType?: string,
    identityReferenceImage?: LessonImageReference,
  ): Promise<Buffer> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey)
      throw new ServiceUnavailableException('OPENAI_API_KEY não configurada.');
    const model =
      this.config.get<string>('OPENAI_IMAGE_MODEL') || 'gpt-image-2.5-sunburst';
    const quality = this.config.get<string>('OPENAI_IMAGE_QUALITY') || 'high';
    this.logger.log(
      `[OpenAI Request] Geração de imagem | Modelo: ${model} | Orientação: ${orientation ?? 'PADRÃO'} | Tipo: ${visualType ?? 'PADRÃO'} | Prompt: "${prompt.slice(0, 120)}..."`,
    );
    const startTime = Date.now();
    try {
      const finalPrompt = `Ilustração bíblica infantil do Clubinho NIB para crianças de 5 a 11 anos. Fidelidade ao contexto bíblico da NVI e à descrição fechada recebida da lição aprovada. Não acrescente personagens, fatos ou símbolos não pedidos. Estratégia pedagógica: ${visualType || 'definida no prompt'}. Orientação obrigatória: ${orientation || 'definida no prompt'}. Sem conteúdo sexual, romântico, erotizado, violência gráfica ou debates de sexualidade. Obedeça literalmente ao estilo, orientação, paleta, margem e finalidade pedidos a seguir. Sem letras, palavras, números, logotipos ou marcas. ${prompt}`;
      const size = orientation === 'PORTRAIT' ? '1024x1536' : '1536x1024';
      const request = identityReferenceImage
        ? (() => {
            const form = new FormData();
            form.append('model', model);
            form.append('prompt', finalPrompt);
            form.append('size', size);
            form.append('quality', quality);
            form.append('output_format', 'png');
            form.append(
              'image[]',
              new Blob([new Uint8Array(identityReferenceImage.data)], {
                type: identityReferenceImage.mimeType,
              }),
              identityReferenceImage.mimeType === 'image/jpeg'
                ? 'clubinho-identidade-visual.jpg'
                : 'clubinho-identidade-visual.png',
            );
            return axios.post<{ data?: Array<{ b64_json?: string }> }>(
              'https://api.openai.com/v1/images/edits',
              form,
              {
                headers: { Authorization: `Bearer ${apiKey}` },
                timeout: 180000,
              },
            );
          })()
        : axios.post<{ data?: Array<{ b64_json?: string }> }>(
            'https://api.openai.com/v1/images/generations',
            {
              model,
              prompt: finalPrompt,
              size,
              quality,
              output_format: 'png',
            },
            {
              headers: { Authorization: `Bearer ${apiKey}` },
              timeout: 180000,
            },
          );
      const response = await request;
      const encoded = response.data.data?.[0]?.b64_json;
      if (!encoded)
        throw new BadGatewayException(
          'OpenAI não retornou os bytes da imagem.',
        );
      const elapsed = Date.now() - startTime;
      this.logger.log(
        `[OpenAI Response] Imagem gerada em ${elapsed}ms | Tamanho: ${encoded.length} b64 chars`,
      );
      return Buffer.from(encoded, 'base64');
    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      const detail =
        error instanceof AxiosError
          ? JSON.stringify(error.response?.data ?? error.message)
          : String(error);
      this.logger.error(
        `[OpenAI Error] Geração de imagem falhou em ${elapsed}ms: ${detail.slice(0, 500)}`,
      );
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        `Falha ao gerar imagem na OpenAI: ${detail.slice(0, 500)}`,
      );
    }
  }
}
