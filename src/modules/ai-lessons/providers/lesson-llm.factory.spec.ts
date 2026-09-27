import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { selectLessonLlmProvider } from './lesson-llm.factory';
import { LessonLlmProviderContract } from './lesson-llm.types';

describe('selectLessonLlmProvider', () => {
  const openAi = {} as LessonLlmProviderContract;
  const gemini = {} as LessonLlmProviderContract;

  it('usa OpenAI por padrão para preservar compatibilidade', () => {
    const config = { get: jest.fn().mockReturnValue(undefined) };
    expect(
      selectLessonLlmProvider(
        config as unknown as ConfigService,
        openAi,
        gemini,
      ),
    ).toBe(openAi);
  });

  it('seleciona Gemini pela variável de ambiente', () => {
    const config = { get: jest.fn().mockReturnValue('gemini') };
    expect(
      selectLessonLlmProvider(
        config as unknown as ConfigService,
        openAi,
        gemini,
      ),
    ).toBe(gemini);
  });

  it('rejeita um provedor desconhecido', () => {
    const config = { get: jest.fn().mockReturnValue('outro') };
    expect(() =>
      selectLessonLlmProvider(
        config as unknown as ConfigService,
        openAi,
        gemini,
      ),
    ).toThrow(ServiceUnavailableException);
  });
});
