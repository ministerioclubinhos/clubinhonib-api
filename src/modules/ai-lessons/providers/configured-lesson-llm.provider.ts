import { Injectable } from '@nestjs/common';
import { GetAiProviderSettingsService } from '../services/get-ai-provider-settings.service';
import { OpenAiLessonService } from '../services/open-ai-lesson.service';
import { GeminiLessonLlmProvider } from './gemini-lesson-llm.provider';
import {
  LessonAttemptProviderMetadata,
  LessonAttemptProviderSnapshot,
  LessonImageReference,
  LessonImageContext,
  LessonImagePurpose,
  LessonLlmGenerationInput,
  LessonLlmGenerationResult,
  LessonLlmProvider,
  LessonLlmProviderContract,
} from './lesson-llm.types';
import { LessonRuntimeConfig } from './lesson-runtime-config';
import { selectLessonLlmProvider } from './lesson-llm.factory';

@Injectable()
export class ConfiguredLessonLlmProvider implements LessonLlmProviderContract {
  constructor(private readonly settings: GetAiProviderSettingsService) {}

  async createAttemptProvider(
    frozen?: LessonAttemptProviderMetadata,
  ): Promise<LessonAttemptProviderSnapshot> {
    const settings = await this.settings.getInternalSettings();
    const providerKey = (
      frozen?.provider ||
      settings.llmProvider ||
      LessonLlmProvider.OPENAI
    )
      .trim()
      .toLowerCase();
    const isGemini = providerKey === String(LessonLlmProvider.GEMINI);
    const textModel = isGemini
      ? frozen?.textModel || settings.gemini.generalModel
      : frozen?.textModel || settings.openai.generalModel;
    const imageModel = isGemini
      ? frozen?.imageModel || settings.gemini.imageModel
      : frozen?.imageModel || settings.openai.imageModel;

    const config = new LessonRuntimeConfig({
      OPENAI_API_KEY: settings.openai.apiKey,
      OPENAI_TEXT_MODEL: isGemini ? settings.openai.generalModel : textModel,
      OPENAI_IMAGE_MODEL: isGemini ? settings.openai.imageModel : imageModel,
      OPENAI_IMAGE_QUALITY: settings.openai.imageQuality,
      OPENAI_REASONING_EFFORT: settings.openai.reasoningEffort,
      GEMINI_API_KEY: settings.gemini.apiKey,
      GEMINI_TEXT_MODEL: isGemini ? textModel : settings.gemini.generalModel,
      GEMINI_TEXT_FALLBACK_MODEL: settings.gemini.fallbackModel,
      GEMINI_IMAGE_MODEL: isGemini ? imageModel : settings.gemini.imageModel,
      GEMINI_IMAGE_SIZE: settings.gemini.imageSize,
      GEMINI_MAX_RETRIES: settings.gemini.maxRetries,
      GEMINI_RETRY_BASE_DELAY_MS: settings.gemini.retryBaseDelayMs,
    });
    const boundProvider = selectLessonLlmProvider(
      providerKey,
      new OpenAiLessonService(config),
      new GeminiLessonLlmProvider(config),
    );
    return {
      provider: boundProvider,
      metadata: {
        provider: isGemini
          ? LessonLlmProvider.GEMINI
          : LessonLlmProvider.OPENAI,
        textModel,
        imageModel,
      },
    };
  }

  private async selected(): Promise<LessonLlmProviderContract> {
    const snapshot = await this.createAttemptProvider();
    return snapshot.provider;
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
    context?: LessonImageContext,
  ): Promise<Buffer> {
    const provider = await this.selected();
    if (context) return provider.generateImage(prompt, orientation, visualType, identityReferenceImage, purpose, context);
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
