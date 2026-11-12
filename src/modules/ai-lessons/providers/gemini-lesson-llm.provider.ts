import type { LessonStructuredRequest } from '../types/lesson-image-brief.types';
import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
import { AiRequestQueueService } from 'src/shared/providers/ai-queue/ai-request-queue.service';
import { AiQueueFeature } from 'src/shared/providers/ai-queue/enums';
import { lessonImageContextPrompt } from '../utils/lesson-image-context.utils';
import { lessonImageTextPolicy } from '../utils/meditation-image.utils';
import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { LessonProviderConfig } from './lesson-llm.types';
import { AxiosError } from 'axios';
import { schemaFor } from '../services/open-ai-lesson.service';
import {
  buildLessonSystemPrompt,
  buildLessonUserPayload,
  lessonOperationLabel,
} from '../utils/lesson-system-prompt.utils';
import { decodeProviderImage } from '../utils/provider-image.utils';
import {
  providerHttpStatus,
  retryProviderRequest,
} from '../utils/provider-retry.utils';
import {
  AI_PROVIDER_MAX_RETRIES,
  AI_PROVIDER_RETRY_DELAY_CAP_MS,
} from '../constants/ai-provider-settings.constants';
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_GEMINI_IMAGE_SIZE,
  DEFAULT_GEMINI_MAX_RETRIES,
  DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
  DEFAULT_GEMINI_TEXT_FALLBACK_MODEL,
  DEFAULT_GEMINI_TEXT_MODEL,
  GEMINI_API_BASE_URL,
  GEMINI_FAILURE_CODE_ALIASES,
  GEMINI_IMAGE_RETRY_STATUSES,
  GEMINI_NO_FALLBACK_REASONS,
  GEMINI_TEXT_RETRY_STATUSES,
  GeminiTextFinishReason,
  LessonImageOrientation,
  PROVIDER_REQUEST,
  PROVIDER_TIMEOUT_FAILURE_CODE,
  PROVIDER_TIMEOUT_NETWORK_CODES,
} from './lesson-llm.constants';
import {
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
  LessonImageReference,
  LessonImageContext,
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
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

/** A content block another Gemini model would repeat: skips the fallback. */
class GeminiContentBlockedException extends BadGatewayException {}

type GeminiImageResponse = {
  id?: string;
  outputImage?: { data?: string; mimeType?: string };
};

@Injectable()
export class GeminiLessonLlmProvider implements LessonLlmProviderContract {
  private readonly logger = new Logger(GeminiLessonLlmProvider.name);

  constructor(
    private readonly config: LessonProviderConfig,
    private readonly queue: AiRequestQueueService,
  ) {}

  async generateStage(
    input: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult> {
    this.requiredApiKey();
    const primaryModel =
      this.config.get<string>('GEMINI_TEXT_MODEL') || DEFAULT_GEMINI_TEXT_MODEL;
    const fallbackModel =
      this.config.get<string>('GEMINI_TEXT_FALLBACK_MODEL') ||
      DEFAULT_GEMINI_TEXT_FALLBACK_MODEL;
    this.logger.log(
      `[Gemini Request] Geração de etapa '${input.stage}' | Operação: ${lessonOperationLabel(input)} | Modelo principal: ${primaryModel} | Fallback: ${fallbackModel} | Semana: ${input.weekNumber}`,
    );
    const startTime = Date.now();
    const systemInstruction = buildLessonSystemPrompt(input);
    const userInput = buildLessonUserPayload(input);

    try {
      const models = [
        ...new Set([primaryModel, fallbackModel].filter(Boolean)),
      ];
      let response: { data: GeminiTextResponse } | undefined;
      let usedModel = primaryModel;
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
                responseJsonSchema:
                  input.structuredRequest?.schema ??
                  schemaFor(
                    input.stage,
                    Boolean(input.olderMeditationReview),
                    input.category,
                  ),
              },
            },
            PROVIDER_REQUEST.textTimeoutMs,
            `texto com ${model}`,
            GEMINI_TEXT_RETRY_STATUSES,
          );

          const candidate = res.data.candidates?.[0];
          const stopReason =
            res.data.promptFeedback?.blockReason ?? candidate?.finishReason;
          if (
            res.data.promptFeedback?.blockReason ||
            (candidate?.finishReason &&
              candidate.finishReason !== GeminiTextFinishReason.STOP)
          ) {
            const message = `Gemini: ${JSON.stringify({ error: { code: stopReason } })}`;
            throw res.data.promptFeedback?.blockReason ||
              (GEMINI_NO_FALLBACK_REASONS as readonly string[]).includes(
                String(stopReason),
              )
              ? new GeminiContentBlockedException(message)
              : new BadGatewayException(message);
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
          usedModel = model;
          rawText = text;
          break;
        } catch (error: unknown) {
          if (error instanceof AiQueueException) throw error;
          if (error instanceof GeminiContentBlockedException) throw error;
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
      const usage = response.data.usageMetadata;
      return {
        content: this.parseStructured(rawText),
        responseId,
        usage: {
          model: usedModel,
          inputTokens: usage?.promptTokenCount,
          outputTokens: usage?.candidatesTokenCount,
          totalTokens: usage?.totalTokenCount,
        },
      };
    } catch (error: unknown) {
      if (error instanceof AiQueueException) throw error;
      const elapsed = Date.now() - startTime;
      this.logger.error(
        `[Gemini Error] Etapa '${input.stage}' falhou em ${elapsed}ms`,
      );
      if (error instanceof BadGatewayException) throw error;
      throw this.externalFailure('texto estruturado', error);
    }
  }

  generateStructured(
    request: LessonStructuredRequest,
    context: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult> {
    return this.generateStage({ ...context, structuredRequest: request });
  }

  async generateImage(
    prompt: string,
    orientation?: string,
    visualType?: string,
    identityReferenceImage?: LessonImageReference,
    purpose?: LessonImagePurpose,
    context?: LessonImageContext,
  ): Promise<Buffer> {
    this.requiredApiKey();
    const model =
      this.config.get<string>('GEMINI_IMAGE_MODEL') ||
      DEFAULT_GEMINI_IMAGE_MODEL;
    const aspectRatio =
      orientation === String(LessonImageOrientation.PORTRAIT) ? '3:4' : '4:3';
    const finalPrompt =
      purpose === LessonImagePurpose.CUTOUT_SHEET
        ? `Prancha de elementos ilustrados para recortar, para crianças de 5 a 11 anos. Orientação obrigatória: ${orientation || 'definida no prompt'}. Sem conteúdo sexual, romântico, erotizado, violência gráfica ou debates de sexualidade. ${lessonImageTextPolicy(purpose)} ${prompt}`
        : `${lessonImageContextPrompt(context)} Para crianças de ${purpose === LessonImagePurpose.MEDITATION_ACTIVITY ? '4 a 11' : '5 a 11'} anos. ` +
          `Não acrescente personagens, fatos ou símbolos não pedidos. Estratégia pedagógica: ${visualType || 'definida no prompt'}. ` +
          `Orientação obrigatória: ${orientation || 'definida no prompt'}. Sem conteúdo sexual, romântico, erotizado, ` +
          `violência gráfica ou debates de sexualidade. ${lessonImageTextPolicy(purpose)} ${prompt}`;

    this.logger.log(
      `[Gemini Request] Geração de imagem | Modelo: ${model} | Orientação: ${orientation ?? 'PADRÃO'} (${aspectRatio}) | Tipo: ${visualType ?? 'PADRÃO'}`,
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
                ...[
                  identityReferenceImage,
                  ...(identityReferenceImage.companions ?? []),
                ].map((image) => ({
                  type: 'image',
                  data: image.data.toString('base64'),
                  mime_type: image.mimeType,
                })),
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
        PROVIDER_REQUEST.imageTimeoutMs,
        `imagem com ${model}`,
        GEMINI_IMAGE_RETRY_STATUSES,
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
      return decodeProviderImage(encoded);
    } catch (error: unknown) {
      if (error instanceof AiQueueException) throw error;
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

  private parseStructured(rawText: string): Record<string, unknown> {
    try {
      const parsed: unknown = JSON.parse(rawText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, unknown>;
    } catch {
      // Reported below with a stable message.
    }
    throw new BadGatewayException(
      'Gemini retornou conteúdo estruturado inválido (JSON malformado).',
    );
  }

  private async postWithRetry<T>(
    url: string,
    body: Record<string, unknown>,
    timeout: number,
    operation: string,
    statuses: readonly number[],
  ): Promise<{ data: T }> {
    const maxRetries = Math.min(
      this.configuredInteger('GEMINI_MAX_RETRIES', DEFAULT_GEMINI_MAX_RETRIES),
      AI_PROVIDER_MAX_RETRIES,
    );
    return retryProviderRequest(
      () =>
        this.queue.post<T>(url, body, {
          feature: AiQueueFeature.LESSONS,
          timeout,
        }),
      {
        maxRetries,
        baseDelayMs: this.configuredInteger(
          'GEMINI_RETRY_BASE_DELAY_MS',
          DEFAULT_GEMINI_RETRY_BASE_DELAY_MS,
        ),
        capMs: AI_PROVIDER_RETRY_DELAY_CAP_MS,
        jitterMs: PROVIDER_REQUEST.retryJitterMs,
        statuses,
      },
      (delayMs, attempt, error) =>
        this.logger.warn(
          `Gemini indisponível em ${operation} (HTTP ${providerHttpStatus(error)}); nova tentativa ${attempt + 2}/${maxRetries + 1} em ${delayMs}ms.`,
        ),
      (error) =>
        !(error instanceof AiQueueException) &&
        !this.isUnavailableFreeTierQuota(error),
    );
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

  private configuredInteger(key: string, fallback: number): number {
    const parsed = Number(this.config.get<string>(key));
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  /**
   * The message keeps a sanitized `{ error: { code, status } }` JSON so the
   * Studio can classify the failure; provider text is never forwarded.
   */
  private externalFailure(
    operation: string,
    error: unknown,
  ): BadGatewayException {
    let detail = error instanceof Error ? error.message : String(error);
    if (error instanceof AxiosError) {
      const data: unknown = error.response?.data;
      const upstream: unknown =
        data && typeof data === 'object'
          ? Reflect.get(data, 'error')
          : undefined;
      const read = (key: string): string | undefined => {
        const value: unknown =
          upstream && typeof upstream === 'object'
            ? Reflect.get(upstream, key)
            : undefined;
        return typeof value === 'string' && value ? value : undefined;
      };
      const status = read('status') ?? read('code');
      const timedOut = (
        PROVIDER_TIMEOUT_NETWORK_CODES as readonly string[]
      ).includes(error.code ?? '');
      const code = timedOut
        ? PROVIDER_TIMEOUT_FAILURE_CODE
        : status
          ? (GEMINI_FAILURE_CODE_ALIASES[status] ?? status)
          : undefined;
      detail = code
        ? JSON.stringify({
            error: { code, status, httpStatus: error.response?.status },
          })
        : `${error.code ? `[${error.code}] ` : ''}HTTP ${error.response?.status ?? 'sem resposta'}`;
    }
    return new BadGatewayException(
      `Falha no Gemini durante a geração de ${operation}: ${detail.slice(0, 500)}`,
    );
  }
}
