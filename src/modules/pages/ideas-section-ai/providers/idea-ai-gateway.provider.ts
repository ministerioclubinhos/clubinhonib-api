import { AiQueueException } from 'src/shared/providers/ai-queue/ai-queue.exception';
import { AiRequestQueueService } from 'src/shared/providers/ai-queue/ai-request-queue.service';
import { AiQueueFeature } from 'src/shared/providers/ai-queue/enums';
import { openAiReasoningEffort } from 'src/modules/ai-lessons/utils/openai-model-capabilities.utils';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InternalAiProviderSettings } from 'src/modules/ai-lessons/types/ai-provider-settings.types';
import { LessonLlmProvider } from 'src/modules/ai-lessons/providers/lesson-llm.types';
import {
  IdeaAiAttachment,
  IdeaAiJsonRequest,
  IdeaAiProviderResponse,
} from '../types';
import { IDEA_AI, IDEA_AI_IMAGE_PROMPT, IDEA_AI_SYSTEM } from '../constants';
import { IdeaAiErrorCode } from '../enums/ideas-section-ai.enums';
@Injectable()
export class IdeaAiGatewayProvider {
  constructor(private readonly queue: AiRequestQueueService) {}
  async json<T extends object>(
    settings: InternalAiProviderSettings,
    request: IdeaAiJsonRequest,
    dto: new () => T,
  ): Promise<T> {
    const configured = settings[settings.llmProvider];
    if (!configured.apiKey || !configured.generalModel)
      throw new Error(IdeaAiErrorCode.PROVIDER_NOT_CONFIGURED);
    const source = `SOURCE_DATA\n${JSON.stringify(request.data)}\nEND_SOURCE_DATA`;
    const attachments = request.attachments ?? [];
    const openai = settings.llmProvider === LessonLlmProvider.OPENAI;
    // Same rule as the Studio: omitted for models without reasoning and for
    // the o-series when the saved effort is `none`.
    const reasoningEffort = openAiReasoningEffort(
      configured.generalModel,
      settings.openai.reasoningEffort,
    );
    const body = openai
      ? {
          model: configured.generalModel,
          store: false,
          ...(reasoningEffort
            ? { reasoning: { effort: reasoningEffort } }
            : {}),
          input: [
            {
              role: 'system',
              content: `${IDEA_AI_SYSTEM}\n${request.instructions}`,
            },
            {
              role: 'user',
              content: [
                { type: 'input_text', text: source },
                ...attachments.map((file) =>
                  file.mimeType.startsWith('image/')
                    ? {
                        type: 'input_image',
                        image_url: `data:${file.mimeType};base64,${file.data.toString('base64')}`,
                      }
                    : {
                        type: 'input_file',
                        filename: file.name,
                        file_data: `data:${file.mimeType};base64,${file.data.toString('base64')}`,
                      },
                ),
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'idea_result',
              strict: true,
              schema: request.schema,
            },
          },
        }
      : {
          systemInstruction: {
            parts: [{ text: `${IDEA_AI_SYSTEM}\n${request.instructions}` }],
          },
          contents: [
            {
              role: 'user',
              parts: [
                { text: source },
                ...attachments.map((file) => ({
                  inlineData: {
                    mimeType: file.mimeType,
                    data: file.data.toString('base64'),
                  },
                })),
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: request.schema,
          },
        };
    const response = await this.request(
      settings,
      configured.generalModel,
      body,
    );
    if (response.incomplete_details)
      throw new Error(IdeaAiErrorCode.INVALID_PROVIDER_RESPONSE);
    const text = openai
      ? response.output
          ?.flatMap((o) => o.content ?? [])
          .filter((c) => c.type === 'output_text')
          .map((c) => c.text ?? '')
          .join('')
      : response.candidates?.[0]?.content?.parts
          ?.map((p) => p.text ?? '')
          .join('');
    try {
      if (!text) throw new Error();
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
        throw new Error();
      const result = plainToInstance(dto, parsed);
      if (
        (
          await validate(result, {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length
      )
        throw new Error();
      return result;
    } catch {
      throw new Error(IdeaAiErrorCode.INVALID_PROVIDER_RESPONSE);
    }
  }
  async editImage(
    settings: InternalAiProviderSettings,
    source: IdeaAiAttachment,
  ): Promise<Buffer> {
    if (settings.llmProvider === LessonLlmProvider.OPENAI) {
      const form = new FormData();
      form.append('model', settings.openai.imageModel);
      form.append('prompt', IDEA_AI_IMAGE_PROMPT);
      form.append('quality', settings.openai.imageQuality);
      form.append('output_format', 'png');
      form.append(
        'image',
        new Blob([new Uint8Array(source.data)], { type: source.mimeType }),
        source.name,
      );
      const result = await this.retry(settings, () =>
        this.queue.post<IdeaAiProviderResponse>(
          'https://api.openai.com/v1/images/edits',
          form,
          {
            feature: AiQueueFeature.SHARED_IDEAS,
            timeout: IDEA_AI.requestTimeoutMs,
            maxContentLength: IDEA_AI.maxFileBytes * 4,
          },
        ),
      );
      const data = result.data.data?.[0]?.b64_json;
      if (!data) throw new Error(IdeaAiErrorCode.INVALID_PROVIDER_RESPONSE);
      return Buffer.from(data, 'base64');
    }
    const response = await this.request(settings, settings.gemini.imageModel, {
      contents: [
        {
          role: 'user',
          parts: [
            { text: IDEA_AI_IMAGE_PROMPT },
            {
              inlineData: {
                mimeType: source.mimeType,
                data: source.data.toString('base64'),
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
        imageConfig: { imageSize: settings.gemini.imageSize },
      },
    });
    const image = response.candidates?.[0]?.content?.parts?.find((p) =>
      p.inlineData?.mimeType.startsWith('image/'),
    )?.inlineData;
    if (!image) throw new Error(IdeaAiErrorCode.INVALID_PROVIDER_RESPONSE);
    return Buffer.from(image.data, 'base64');
  }
  private async request(
    settings: InternalAiProviderSettings,
    model: string,
    body: object,
  ): Promise<IdeaAiProviderResponse> {
    const openai = settings.llmProvider === LessonLlmProvider.OPENAI;
    const response = await this.retry(settings, () =>
      this.queue.post<IdeaAiProviderResponse>(
        openai
          ? 'https://api.openai.com/v1/responses'
          : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        body,
        {
          feature: AiQueueFeature.SHARED_IDEAS,
          timeout: IDEA_AI.requestTimeoutMs,
          maxContentLength: IDEA_AI.maxFileBytes * 4,
        },
      ),
    );
    return response.data;
  }
  private async retry<T>(
    settings: InternalAiProviderSettings,
    run: () => Promise<T>,
  ): Promise<T> {
    const gemini = settings.llmProvider === LessonLlmProvider.GEMINI;
    const retries = Math.min(
      gemini ? settings.gemini.maxRetries : IDEA_AI.maxRetries,
      IDEA_AI.maxRetries,
    );
    for (let attempt = 0; ; attempt++) {
      try {
        return await run();
      } catch (error: unknown) {
        if (error instanceof AiQueueException) throw error;
        const status = axios.isAxiosError(error)
          ? error.response?.status
          : undefined;
        if (attempt >= retries || !status || !(status === 429 || status >= 500))
          throw new Error(IdeaAiErrorCode.PROVIDER_REQUEST_FAILED);
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            Math.min(
              30_000,
              (gemini ? settings.gemini.retryBaseDelayMs : IDEA_AI.retryMs) *
                2 ** attempt,
            ),
          ),
        );
      }
    }
  }
}
