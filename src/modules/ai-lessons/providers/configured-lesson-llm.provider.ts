import { AiRequestQueueService } from 'src/shared/providers/ai-queue/ai-request-queue.service';
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
import {
  AI_PROVIDER_MAX_RETRIES,
  AI_PROVIDER_MAX_RETRY_DELAY_MS,
} from '../constants/ai-provider-settings.constants';

function frozenInteger(
  frozen: unknown,
  fallback: number,
  maximum: number,
): number {
  const value =
    typeof frozen === 'number' && Number.isInteger(frozen) && frozen >= 0
      ? frozen
      : fallback;
  return Math.min(value, maximum);
}

@Injectable()
export class ConfiguredLessonLlmProvider implements LessonLlmProviderContract {
  constructor(
    private readonly settings: GetAiProviderSettingsService,
    private readonly queue: AiRequestQueueService,
  ) {}

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

    // Every non-secret parameter comes from the frozen snapshot when present,
    // so a resumed attempt cannot silently change quality, fallback or retries.
    const metadata: LessonAttemptProviderMetadata = {
      provider: isGemini ? LessonLlmProvider.GEMINI : LessonLlmProvider.OPENAI,
      textModel,
      imageModel,
      imageQuality: frozen?.imageQuality || settings.openai.imageQuality,
      reasoningEffort:
        frozen?.reasoningEffort || settings.openai.reasoningEffort,
      fallbackModel: frozen?.fallbackModel || settings.gemini.fallbackModel,
      imageSize: frozen?.imageSize || settings.gemini.imageSize,
      maxRetries: frozenInteger(
        frozen?.maxRetries,
        settings.gemini.maxRetries,
        AI_PROVIDER_MAX_RETRIES,
      ),
      retryBaseDelayMs: frozenInteger(
        frozen?.retryBaseDelayMs,
        settings.gemini.retryBaseDelayMs,
        AI_PROVIDER_MAX_RETRY_DELAY_MS,
      ),
    };
    const config = new LessonRuntimeConfig({
      OPENAI_API_KEY: settings.openai.apiKey,
      OPENAI_TEXT_MODEL: isGemini ? settings.openai.generalModel : textModel,
      OPENAI_IMAGE_MODEL: isGemini ? settings.openai.imageModel : imageModel,
      OPENAI_IMAGE_QUALITY: metadata.imageQuality ?? '',
      OPENAI_REASONING_EFFORT: metadata.reasoningEffort ?? '',
      GEMINI_API_KEY: settings.gemini.apiKey,
      GEMINI_TEXT_MODEL: isGemini ? textModel : settings.gemini.generalModel,
      GEMINI_TEXT_FALLBACK_MODEL: metadata.fallbackModel ?? '',
      GEMINI_IMAGE_MODEL: isGemini ? imageModel : settings.gemini.imageModel,
      GEMINI_IMAGE_SIZE: metadata.imageSize ?? '',
      GEMINI_MAX_RETRIES: metadata.maxRetries ?? 0,
      GEMINI_RETRY_BASE_DELAY_MS: metadata.retryBaseDelayMs ?? 0,
    });
    const boundProvider = selectLessonLlmProvider(
      providerKey,
      new OpenAiLessonService(config, this.queue),
      new GeminiLessonLlmProvider(config, this.queue),
    );
    return { provider: boundProvider, metadata };
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
    return (await this.selected()).generateImage(
      prompt,
      orientation,
      visualType,
      identityReferenceImage,
      purpose,
      context,
    );
  }
}
