import { Injectable } from '@nestjs/common';
import { GetAiProviderSettingsService } from '../services/get-ai-provider-settings.service';
import { OpenAiLessonService } from '../services/open-ai-lesson.service';
import { GeminiLessonLlmProvider } from './gemini-lesson-llm.provider';
import {
  LessonImageReference,
  LessonImagePurpose,
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
  LessonLlmProviderContract,
} from './lesson-llm.types';
import { LessonRuntimeConfig } from './lesson-runtime-config';
import { selectLessonLlmProvider } from './lesson-llm.factory';

@Injectable()
export class ConfiguredLessonLlmProvider implements LessonLlmProviderContract {
  constructor(private readonly settings: GetAiProviderSettingsService) {}

  private async selected(): Promise<LessonLlmProviderContract> {
    const settings = await this.settings.getSettings();
    const config = new LessonRuntimeConfig({
      OPENAI_API_KEY: settings.openai.apiKey,
      OPENAI_TEXT_MODEL: settings.openai.generalModel,
      OPENAI_IMAGE_MODEL: settings.openai.imageModel,
      OPENAI_IMAGE_QUALITY: settings.openai.imageQuality,
      OPENAI_REASONING_EFFORT: settings.openai.reasoningEffort,
      GEMINI_API_KEY: settings.gemini.apiKey,
      GEMINI_TEXT_MODEL: settings.gemini.generalModel,
      GEMINI_TEXT_FALLBACK_MODEL: settings.gemini.fallbackModel,
      GEMINI_IMAGE_MODEL: settings.gemini.imageModel,
      GEMINI_IMAGE_SIZE: settings.gemini.imageSize,
      GEMINI_MAX_RETRIES: settings.gemini.maxRetries,
      GEMINI_RETRY_BASE_DELAY_MS: settings.gemini.retryBaseDelayMs,
    });
    return selectLessonLlmProvider(
      settings.llmProvider,
      new OpenAiLessonService(config),
      new GeminiLessonLlmProvider(config),
    );
  }

  async generateStage(
    input: LessonLlmGenerationInput,
  ): Promise<LessonLlmGenerationResult> {
    return (await this.selected()).generateStage(input);
  }

  async generateImage(
    prompt: string,
    orientation?: string,
    visualType?: string,
    identityReferenceImage?: LessonImageReference,
    purpose?: LessonImagePurpose,
  ): Promise<Buffer> {
    const provider = await this.selected();
    return purpose
      ? provider.generateImage(
          prompt,
          orientation,
          visualType,
          identityReferenceImage,
          purpose,
        )
      : provider.generateImage(
          prompt,
          orientation,
          visualType,
          identityReferenceImage,
        );
  }
}
