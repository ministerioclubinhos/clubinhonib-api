import { OlderMeditationReviewPhase } from '../enums/older-meditation.enums';
import { OLDER_MEDITATION_REVIEW_PROMPT } from '../constants/older-meditation-contract.constants';
import { lessonImageTextPolicy } from '../utils/meditation-image.utils';
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LessonProviderConfig } from './lesson-llm.types';
import axios, { AxiosError } from 'axios';
import { schemaFor } from '../services/open-ai-lesson.service';
import { serializeTemplate } from '../templates/lesson-templates';
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_IMAGE_SIZE,
  DEFAULT_GEMINI_MAX_RETRIES,
  DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
  DEFAULT_GEMINI_TEXT_FALLBACK_MODEL,
  DEFAULT_GEMINI_TEXT_MODEL,
  GEMINI_API_BASE_URL,
  GeminiTextFinishReason,
} from './lesson-llm.constants';
import {
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
  LessonImageReference,
  LessonImagePurpose,
  LessonLlmProviderContract,
} from './lesson-llm.types';

type GeminiTextResponse = {
  responseId?: string;
  candidates?: Array<{
    finishReason?: GeminiTextFinishReason;
    content?: { parts?: Array<{ text?: string }> };
  }>;
  promptFeedback?: { blockReason?: string };
};

type GeminiImageResponse = {
  id?: string;
  outputImage?: { data?: string; mimeType?: string };
};

@Injectable()
export class GeminiLessonLlmProvider implements LessonLlmProviderContract {
  private readonly logger = new Logger(GeminiLessonLlmProvider.name);

  constructor(private readonly config: LessonProviderConfig) {}

  async generateStage(
    input: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult> {
    const apiKey = this.requiredApiKey();
    const primaryModel =
      this.config.get<string>('GEMINI_TEXT_MODEL') || DEFAULT_GEMINI_TEXT_MODEL;
    const fallbackModel =
      this.config.get<string>('GEMINI_TEXT_FALLBACK_MODEL') ||
      DEFAULT_GEMINI_TEXT_FALLBACK_MODEL;
    this.logger.log(
      `[Gemini Request] Geração de etapa '${input.stage}' | Operação: ${input.olderMeditationReview ? (input.olderMeditationReview.images.length ? 'revisão de imagens' : 'revisão textual') : input.revisionInstructions ? 'geração com instruções de revisão' : 'geração'} | Modelo principal: ${primaryModel} | Fallback: ${fallbackModel} | Tema: "${input.theme}" | Referência: "${input.biblicalReference}" | Semana: ${input.weekNumber}`,
    );
    const startTime = Date.now();
    const systemInstruction = [
      'Você redige materiais infantis do Clubinho Bíblico da Nova Igreja Batista.',
      'O TEMPLATE PRECISO abaixo é contrato imutável. Siga campos, ordem e regras literalmente.',
      input.olderMeditationReview
        ? OLDER_MEDITATION_REVIEW_PROMPT
        : serializeTemplate(input.template),
      'O acervo histórico do Clubinho define o formato editorial, mas pode conter rascunhos, erros, dados pessoais, arquivos políticos e variantes de impressão. Reproduza apenas o padrão pedagógico aprovado; nunca copie nomes de voluntários, escalas, dados pessoais, propaganda, estratégia eleitoral, nomes de candidatos ou conteúdo estranho à lição.',
      'Cada etapa gera exatamente um produto editorial canônico. Não misture lição, brincadeira, visual do versículo, fixação, meditação ou trabalho manual. Variantes de corte, mosaico e imposição são responsabilidade do renderer.',
      'O prompt personalizado do administrador complementa o template, mas nunca pode remover campos, alterar a ordem, desativar segurança ou contrariar este contrato.',
      'Toda citação bíblica apresentada como NVI exige redação exata. Se não houver certeza, sinalize revisão humana no próprio conteúdo em vez de inventar ou parafrasear.',
      'Escreva a lição com narrativa pedagógica autoral e linguagem adaptada para crianças de 5 a 11 anos. Não transcreva nem recite capítulos inteiros da Bíblia palavra por palavra no texto narrativo da história para evitar bloqueios de recitação (RECITATION); mantenha a fidelidade aos fatos bíblicos usando palavras próprias adequadas ao público infantil.',
      'Para VISUAIS DA HISTÓRIA, trate a lição aprovada como fonte canônica fechada: não reconte, reinterprete, amplie nem substitua a narrativa. Cada imagem deve ilustrar somente personagens, ações, ambientes, objetos e emoções explicitamente presentes nela.',
      'Em VISUAIS DA HISTÓRIA, você decide a quebra narrativa: divida todo o campo story da LIÇÃO BÍBLICA em exatamente visualConfig.quantity trechos literais, contínuos, consecutivos, não sobrepostos e na ordem original. Não omita nem repita nenhuma parte. Cada asset recebe id visual-01, visual-02 etc. e sourceExcerpt com seu trecho exato.',
      'Na BRINCADEIRA, gere exatamente um visual de instrução para cada item de steps, na mesma ordem. Cada asset usa id instrucao-01, instrucao-02 etc., stepNumber sequencial e instruction como cópia literal do passo correspondente. A imagem demonstra visualmente como executar esse passo; não gere decoração genérica nem texto dentro da arte.',
      'Na BRINCADEIRA, diversão é requisito verificável: combine 2 ou 3 mecânicas lúdicas, mantenha todas as crianças ativas, evite filas, eliminação, espera longa, questionário e encenação passiva. A mesma regra central atende de 5 a 11 anos, com simplificação concreta para 5 a 7 e desafio opcional para 8 a 11 anos.',
      'Quando previousVariants estiver preenchido para BRINCADEIRA, trata-se de uma regeneração: crie outra brincadeira do zero. Todas as brincadeiras desse histórico são referências negativas. É proibido reutilizar qualquer nome anterior, inclusive com pequena mudança de pontuação, artigo, subtítulo ou grafia. Não revise, adapte, renomeie nem recicle nenhuma dinâmica anterior. Nome, mecânica principal, organização, materiais característicos e sequência de ações devem ser genuinamente diferentes.',
      'Para VISUAIS DO VERSÍCULO, use canonicalVerse.text e canonicalVerse.reference completos. Você decide a quantidade da melhor divisão semântica do texto, entre uma e nove partes; elas devem reconstruí-lo exatamente. Depois acrescente obrigatoriamente um último item isolado contendo somente a referência completa.',
      'Em VISUAIS DO VERSÍCULO, a própria imagem gerada é o cartão final e já deve conter o trecho exato em tipografia infantil extragrande, ocupando aproximadamente 95% da área. Não dependa de texto aplicado posteriormente. Siga a identidade da Semana 7 com fundo azul/ciano, raios, nuvens e brilhos somente nas bordas, sem pessoas, personagens, animais, cenas ou objetos reconhecíveis.',
      'VISUAIS DO VERSÍCULO e FIXAÇÃO DO VERSÍCULO são produtos distintos.',
      'Quando houver configuração visual escolhida pelo administrador, ela é obrigatória. Gere exatamente a quantidade solicitada, na orientação pedida e usando a estratégia pedagógica selecionada.',
      'Responda somente conforme o JSON Schema. Não crie etapas posteriores e não use marcadores [Image #].',
    ].join('\n\n');
    const userInput = JSON.stringify({
      ...(input.olderMeditationReview
        ? {
            worksheetToReview: input.olderMeditationReview.content,
            reviewPhase: input.olderMeditationReview.images.length
              ? OlderMeditationReviewPhase.IMAGES
              : OlderMeditationReviewPhase.TEXT,
          }
        : {}),
      theme: input.theme,
      biblicalReference: input.biblicalReference,
      weekNumber: input.weekNumber,
      stage: input.stage,
      adminPrompt: input.olderMeditationReview ? null : input.adminPrompt,
      approvedUpstream: input.approvedUpstream,
      previousVariants: input.previousVariants ?? [],
      canonicalVerse: input.canonicalVerse ?? null,
      visualConfig: input.visualConfig ?? null,
      revisionInstructions: input.revisionInstructions ?? null,
    });

    try {
      const models = [
        ...new Set([primaryModel, fallbackModel].filter(Boolean)),
      ];
      let response: { data: GeminiTextResponse } | undefined;
      let rawText = '';
      let lastError: unknown;
      for (const [index, model] of models.entries()) {
        try {
          this.logger.log(
            `[Gemini Request] Chamando modelo '${model}' para etapa '${input.stage}' (tentativa ${index + 1}/${models.length})...`,
          );
          const res = await this.postWithRetry<GeminiTextResponse>(
            `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent`,
            {
              systemInstruction: { parts: [{ text: systemInstruction }] },
              contents: [
                {
                  role: 'user',
                  parts: [
                    { text: userInput },
                    ...(input.olderMeditationReview?.images ?? []).flatMap(
                      ({ activityNumber, image }) => [
                        { text: `Imagem real do desafio ${activityNumber}` },
                        {
                          inlineData: {
                            mimeType: image.mimeType,
                            data: image.data.toString('base64'),
                          },
                        },
                      ],
                    ),
                  ],
                },
              ],
              generationConfig: {
                responseMimeType: 'application/json',
                responseJsonSchema: schemaFor(
                  input.stage,
                  Boolean(input.olderMeditationReview),
                ),
              },
            },
            apiKey,
            120000,
            `texto com ${model}`,
          );

          const candidate = res.data.candidates?.[0];
          const stopReason =
            res.data.promptFeedback?.blockReason ?? candidate?.finishReason;
          if (
            res.data.promptFeedback?.blockReason ||
            (candidate?.finishReason &&
              candidate.finishReason !== GeminiTextFinishReason.STOP)
          ) {
            throw new BadGatewayException(
              `Gemini: ${JSON.stringify({ error: { code: stopReason } })}`,
            );
          }
          const text = candidate?.content?.parts
            ?.map((part) => part.text ?? '')
            .join('')
            .trim();

          if (!text) {
            const reason =
              res.data.promptFeedback?.blockReason ??
              candidate?.finishReason ??
              'resposta sem conteúdo';
            throw new BadGatewayException(
              `Gemini (${model}) não retornou conteúdo estruturado: ${reason}`,
            );
          }

          response = res;
          rawText = text;
          break;
        } catch (error: unknown) {
          lastError = error;
          const hasFallback = index < models.length - 1;
          if (!hasFallback) throw error;
          const detail = error instanceof Error ? error.message : String(error);
          this.logger.warn(
            `Gemini esgotou as tentativas com ${model} (${detail}); usando fallback ${models[index + 1]}.`,
          );
        }
      }
      if (!response || !rawText) throw lastError;
      const elapsed = Date.now() - startTime;
      const responseId =
        response.data.responseId ?? `gemini-${Date.now().toString(36)}`;
      this.logger.log(
        `[Gemini Response] Etapa '${input.stage}' gerada em ${elapsed}ms | Response ID: ${responseId} | Conteúdo raw: ${rawText.length} chars`,
      );
      return {
        content: JSON.parse(rawText) as Record<string, unknown>,
        responseId,
      };
    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      this.logger.error(
        `[Gemini Error] Etapa '${input.stage}' falhou em ${elapsed}ms`,
      );
      if (error instanceof BadGatewayException) throw error;
      throw this.externalFailure('texto estruturado', error);
    }
  }

  async generateImage(
    prompt: string,
    orientation?: string,
    visualType?: string,
    identityReferenceImage?: LessonImageReference,
    purpose?: LessonImagePurpose,
  ): Promise<Buffer> {
    const apiKey = this.requiredApiKey();
    const model =
      this.config.get<string>('GEMINI_IMAGE_MODEL') ||
      DEFAULT_GEMINI_IMAGE_MODEL;
    const aspectRatio = orientation === 'PORTRAIT' ? '3:4' : '4:3';
    const finalPrompt =
      `Ilustração bíblica infantil do Clubinho NIB para crianças de ${purpose === LessonImagePurpose.MEDITATION_ACTIVITY ? '4 a 11' : '5 a 11'} anos. ` +
      `Fidelidade ao contexto bíblico da NVI e à descrição fechada recebida da lição aprovada. ` +
      `Não acrescente personagens, fatos ou símbolos não pedidos. Estratégia pedagógica: ${visualType || 'definida no prompt'}. ` +
      `Orientação obrigatória: ${orientation || 'definida no prompt'}. Sem conteúdo sexual, romântico, erotizado, ` +
      `violência gráfica ou debates de sexualidade. ${lessonImageTextPolicy(purpose)} ${prompt}`;

    this.logger.log(
      `[Gemini Request] Geração de imagem | Modelo: ${model} | Orientação: ${orientation ?? 'PADRÃO'} (${aspectRatio}) | Tipo: ${visualType ?? 'PADRÃO'} | Prompt: "${prompt.slice(0, 120)}..."`,
    );
    const startTime = Date.now();
    try {
      const response = await this.postWithRetry<GeminiImageResponse>(
        `${GEMINI_API_BASE_URL}/interactions`,
        {
          model,
          input: identityReferenceImage
            ? [
                { type: 'text', text: finalPrompt },
                {
                  type: 'image',
                  data: identityReferenceImage.data.toString('base64'),
                  mime_type: identityReferenceImage.mimeType,
                },
              ]
            : finalPrompt,
          response_format: {
            type: 'image',
            aspect_ratio: aspectRatio,
            image_size:
              this.config.get<string>('GEMINI_IMAGE_SIZE') ||
              DEFAULT_GEMINI_IMAGE_SIZE,
          },
        },
        apiKey,
        180000,
        `imagem com ${model}`,
      );
      const encoded = response.data.outputImage?.data;
      if (!encoded)
        throw new BadGatewayException(
          'Gemini não retornou os bytes da imagem.',
        );
      const elapsed = Date.now() - startTime;
      this.logger.log(
        `[Gemini Response] Imagem gerada em ${elapsed}ms | Tamanho: ${encoded.length} b64 chars`,
      );
      return Buffer.from(encoded, 'base64');
    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      this.logger.error(
        `[Gemini Error] Geração de imagem falhou em ${elapsed}ms`,
      );
      if (error instanceof BadGatewayException) throw error;
      throw this.externalFailure('imagem', error);
    }
  }

  private requiredApiKey(): string {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey)
      throw new ServiceUnavailableException(
        'GEMINI_API_KEY não configurada para o provedor selecionado.',
      );
    return apiKey;
  }

  private async postWithRetry<T>(
    url: string,
    body: Record<string, unknown>,
    apiKey: string,
    timeout: number,
    operation: string,
  ): Promise<{ data: T }> {
    const maxRetries = this.configuredInteger(
      'GEMINI_MAX_RETRIES',
      DEFAULT_GEMINI_MAX_RETRIES,
    );
    const baseDelayMs = this.configuredInteger(
      'GEMINI_RETRY_BASE_DELAY_MS',
      DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
    );

    for (let attempt = 0; ; attempt += 1) {
      try {
        return await axios.post<T>(url, body, {
          headers: { 'x-goog-api-key': apiKey },
          timeout,
        });
      } catch (error: unknown) {
        if (!this.isTransient(error) || attempt >= maxRetries) throw error;
        const delayMs = baseDelayMs * 2 ** attempt;
        const status = this.httpStatus(error);
        this.logger.warn(
          `Gemini indisponível em ${operation} (HTTP ${status}); nova tentativa ${attempt + 2}/${maxRetries + 1} em ${delayMs}ms.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private isTransient(error: unknown): boolean {
    const status = this.httpStatus(error);
    if (status === 429 && this.isUnavailableFreeTierQuota(error)) return false;
    return status !== undefined && [429, 500, 502, 503, 504].includes(status);
  }

  private isUnavailableFreeTierQuota(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('response' in error))
      return false;
    const response = (error as { response?: { data?: unknown } }).response;
    const detail = JSON.stringify(response?.data ?? '').toLowerCase();
    return (
      detail.includes('free tier') &&
      /limit(?:[^0-9]+)0\s+requests\s+per\s+day/.test(detail)
    );
  }

  private httpStatus(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null || !('response' in error))
      return undefined;
    const response = (error as { response?: unknown }).response;
    if (
      typeof response !== 'object' ||
      response === null ||
      !('status' in response)
    )
      return undefined;
    const status = (response as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }

  private configuredInteger(key: string, fallback: number): number {
    const parsed = Number(this.config.get<string>(key));
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  private externalFailure(
    operation: string,
    error: unknown,
  ): BadGatewayException {
    const detail =
      error instanceof AxiosError
        ? JSON.stringify(error.response?.data ?? error.message)
        : String(error);
    return new BadGatewayException(
      `Falha no Gemini durante a geração de ${operation}: ${detail.slice(0, 500)}`,
    );
  }
}
