import { ServiceUnavailableException } from '@nestjs/common';
import {
  LessonLlmProvider,
  LessonLlmProviderContract,
} from './lesson-llm.types';

export function selectLessonLlmProvider(
  configured: string,
  openAi: LessonLlmProviderContract,
  gemini: LessonLlmProviderContract,
): LessonLlmProviderContract {
  const providers: Record<LessonLlmProvider, LessonLlmProviderContract> = {
    [LessonLlmProvider.OPENAI]: openAi,
    [LessonLlmProvider.GEMINI]: gemini,
  };
  if (!Object.prototype.hasOwnProperty.call(providers, configured))
    throw new ServiceUnavailableException(
      'Provedor de IA inválido. Use openai ou gemini.',
    );
  return providers[configured as LessonLlmProvider];
}
