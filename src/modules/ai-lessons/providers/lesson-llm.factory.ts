import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LessonLlmProvider,
  LessonLlmProviderContract,
} from './lesson-llm.types';

export function selectLessonLlmProvider(
  config: ConfigService,
  openAi: LessonLlmProviderContract,
  gemini: LessonLlmProviderContract,
): LessonLlmProviderContract {
  const configured = (
    config.get<string>('LLM_PROVIDER') ?? LessonLlmProvider.OPENAI
  ).toLocaleLowerCase('en-US');
  const providers: Record<LessonLlmProvider, LessonLlmProviderContract> = {
    [LessonLlmProvider.OPENAI]: openAi,
    [LessonLlmProvider.GEMINI]: gemini,
  };
  if (!Object.prototype.hasOwnProperty.call(providers, configured))
    throw new ServiceUnavailableException(
      `LLM_PROVIDER inválido: ${configured}. Use openai ou gemini.`,
    );
  return providers[configured as LessonLlmProvider];
}
