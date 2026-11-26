import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GetAiProviderSettingsService } from 'src/modules/ai-lessons/services/get-ai-provider-settings.service';
import { AiProviderTransportProvider } from './ai-provider-transport.provider';
import {
  AiQueueBodyKind,
  AiQueueFeature,
  AiQueueMethod,
  AiQueueProviderName,
  AiQueueFailure,
} from './enums';
import { AiQueueRequest } from './types';

jest.mock('axios');
const httpRequest = jest.spyOn(axios, 'request');

describe('queued provider transport', () => {
  const settings = {
    getInternalOpenAiSettings: jest.fn(),
    getInternalGeminiSettings: jest.fn(),
  };
  const liveConfig = { get: jest.fn(() => undefined) };
  const transport = new AiProviderTransportProvider(
    settings as unknown as GetAiProviderSettingsService,
    liveConfig as unknown as ConfigService,
  );
  const request = (): AiQueueRequest => ({
    provider: AiQueueProviderName.OPENAI,
    feature: AiQueueFeature.LESSONS,
    method: AiQueueMethod.POST,
    url: 'https://api.openai.com/v1/responses',
    body: { kind: AiQueueBodyKind.JSON, json: { model: 'pinned' } },
    expiresAt: Date.now() + 5000,
    timeoutMs: 120000,
    maxContentLength: 1024,
  });
  beforeEach(() => {
    jest.resetAllMocks();
    settings.getInternalOpenAiSettings.mockResolvedValue({
      apiKey: 'current-openai-key',
    });
    settings.getInternalGeminiSettings.mockResolvedValue({
      apiKey: 'current-gemini-key',
    });
    httpRequest.mockResolvedValue({
      data: {},
      status: 200,
      headers: { 'x-request-id': 'id', authorization: 'secret' },
    });
  });

  it('resolves current credentials only at execution and pins the model from the job', async () => {
    const result = await transport.execute(request());
    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { model: 'pinned' },
        headers: { Authorization: 'Bearer current-openai-key' },
        maxRedirects: 0,
      }),
    );
    expect(result.headers).toEqual({ 'x-request-id': 'id' });
    expect(httpRequest.mock.calls[0][0]).toHaveProperty(
      'timeout',
      expect.any(Number),
    );
  });

  it('uses the Gemini credential and avoids HTTP on expired jobs', async () => {
    const value = request();
    value.provider = AiQueueProviderName.GEMINI;
    value.url = 'https://generativelanguage.googleapis.com/v1beta/interactions';
    await transport.execute(value);
    expect(httpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'x-goog-api-key': 'current-gemini-key' },
      }),
    );
    httpRequest.mockClear();
    value.expiresAt = Date.now() - 1;
    await expect(transport.execute(value)).rejects.toThrow();
    expect(httpRequest).not.toHaveBeenCalled();
  });

  it('rejects mismatched providers, arbitrary destinations and missing credentials', async () => {
    await expect(
      transport.execute({ ...request(), provider: AiQueueProviderName.GEMINI }),
    ).rejects.toThrow();
    await expect(
      transport.execute({ ...request(), url: 'https://evil.test' }),
    ).rejects.toThrow();
    settings.getInternalOpenAiSettings.mockResolvedValue({ apiKey: '' });
    await expect(transport.execute(request())).rejects.toMatchObject({
      reason: AiQueueFailure.CREDENTIAL_MISSING,
    });
    expect(httpRequest).not.toHaveBeenCalled();
  });

  it('sends a GET without a body, which Google rejects', async () => {
    await transport.execute({
      ...request(),
      provider: AiQueueProviderName.GEMINI,
      method: AiQueueMethod.GET,
      url: 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',
      body: { kind: AiQueueBodyKind.JSON, json: {} },
    });
    const sent = httpRequest.mock.calls[0][0] as Record<string, unknown>;
    expect(sent).not.toHaveProperty('data');
    expect(sent.headers).toEqual({ 'x-goog-api-key': 'current-gemini-key' });
  });
});
