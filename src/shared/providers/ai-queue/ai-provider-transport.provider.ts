import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import {
  AiProviderMode,
  AiQueueProviderName,
  AiQueueFailure,
  AiQueueMethod,
} from './enums';
import { AiQueueRequest, AiQueueResponse } from './types';
import { aiQueueEndpoint, restoreAiBody, safeAiHeaders } from './utils';
import { AiQueueException } from './ai-queue.exception';
import { AI_PROVIDER_MODE_ENV, AI_QUEUE } from './constants';
import {
  fakeAiResponse,
  resolveAiProviderMode,
} from './fake-ai-response.utils';

/** Only the queue worker may use this transport. Credentials never enter Redis. */
@Injectable()
export class AiProviderTransportProvider {
  private readonly logger = new Logger(AiProviderTransportProvider.name);
  readonly mode: AiProviderMode;

  constructor(
    private readonly settings: GetAiProviderSettingsService,
    config: ConfigService,
  ) {
    this.mode = resolveAiProviderMode(
      config.get<string>(AI_PROVIDER_MODE_ENV),
      config.get<string>('NODE_ENV'),
    );
    if (this.mode === AiProviderMode.FAKE)
      this.logger.warn(
        'AI_PROVIDER_MODE=fake: nenhuma chamada sai para OpenAI/Gemini; respostas de IA são simuladas.',
      );
  }

  async execute(request: AiQueueRequest): Promise<AiQueueResponse> {
    const endpoint = aiQueueEndpoint(request.url, request.method);
    if (endpoint.provider !== request.provider)
      throw new AiQueueException(AiQueueFailure.INVALID_REQUEST);
    // Mesma validação de rota, mas sem rede, chave nem custo.
    if (this.mode === AiProviderMode.FAKE) return fakeAiResponse(request);
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
      // Google rejects a GET that carries a body.
      ...(request.method === AiQueueMethod.GET
        ? {}
        : { data: restoreAiBody(request.body) }),
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
