import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { AiQueueProviderName, AiQueueFailure } from './enums';
import { AiQueueRequest, AiQueueResponse } from './types';
import { aiQueueEndpoint, restoreAiBody, safeAiHeaders } from './utils';
import { AiQueueException } from './ai-queue.exception';
import { AI_QUEUE } from './constants';

/** Only the queue worker may use this transport. Credentials never enter Redis. */
@Injectable()
export class AiProviderTransportProvider {
  constructor(private readonly settings: GetAiProviderSettingsService) {}

  async execute(request: AiQueueRequest): Promise<AiQueueResponse> {
    const endpoint = aiQueueEndpoint(request.url, request.method);
    if (endpoint.provider !== request.provider)
      throw new AiQueueException(AiQueueFailure.INVALID_REQUEST);
    const settings =
      request.provider === AiQueueProviderName.OPENAI
        ? await this.settings.getInternalOpenAiSettings()
        : await this.settings.getInternalGeminiSettings();
    if (!settings.apiKey)
      throw new AiQueueException(AiQueueFailure.CREDENTIAL_MISSING);
    const remaining = request.expiresAt - Date.now();
    if (remaining <= 0) throw new AiQueueException(AiQueueFailure.EXPIRED);
    const response = await axios.request<unknown>({
      method: request.method,
      url: endpoint.url,
      data: restoreAiBody(request.body),
      headers:
        request.provider === AiQueueProviderName.OPENAI
          ? { Authorization: `Bearer ${settings.apiKey}` }
          : { 'x-goog-api-key': settings.apiKey },
      timeout: Math.min(request.timeoutMs, remaining, AI_QUEUE.maxRequestMs),
      maxContentLength: Math.min(
        request.maxContentLength,
        AI_QUEUE.maxResponseBytes,
      ),
      maxBodyLength: AI_QUEUE.maxPayloadBytes,
      maxRedirects: 0,
    });
    return {
      data: response.data,
      status: response.status,
      headers: safeAiHeaders(response.headers),
    };
  }
}
