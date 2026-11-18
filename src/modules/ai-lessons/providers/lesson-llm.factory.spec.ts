import { ServiceUnavailableException } from '@nestjs/common';
import { selectLessonLlmProvider } from './lesson-llm.factory';
import { LessonLlmProviderContract } from './lesson-llm.types';

describe('selectLessonLlmProvider', () => {
  const openAi = {} as LessonLlmProviderContract;
  const gemini = {} as LessonLlmProviderContract;

  it('seleciona OpenAI pela configuração salva', () => {
    expect(selectLessonLlmProvider('openai', openAi, gemini)).toBe(openAi);
  });

  it('seleciona Gemini pela configuração salva', () => {
    expect(selectLessonLlmProvider('gemini', openAi, gemini)).toBe(gemini);
  });

  it('rejeita um provedor desconhecido', () => {
    expect(() => selectLessonLlmProvider('outro', openAi, gemini)).toThrow(
      ServiceUnavailableException,
    );
  });
});
