import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { LessonLlmProvider } from './providers/lesson-llm.types';

export function providerSettingString(
  value: unknown,
  fallback: string,
): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function providerSettingInteger(
  value: unknown,
  fallback: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function parseLessonProvider(value: unknown): LessonLlmProvider {
  const normalized =
    typeof value === 'string' ? value.trim().toLowerCase() : value;
  if (
    normalized === LessonLlmProvider.OPENAI ||
    normalized === LessonLlmProvider.GEMINI
  )
    return normalized;
  throw new AppValidationException(
    ErrorCode.VALIDATION_ERROR,
    'Provedor de IA inválido. Escolha OpenAI ou Gemini.',
  );
}
