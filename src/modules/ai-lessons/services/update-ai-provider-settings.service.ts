import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { AiProviderSettingRepository } from '../repositories/ai-provider-setting.repository';
import {
  AI_PROVIDER_SECRET,
  AiProviderSettingsKey,
} from '../constants/ai-provider-settings.constants';
import { GetAiProviderSettingsService } from './get-ai-provider-settings.service';
import {
  SaveAiProviderSettingsDto,
  SaveGeminiSettingsDto,
  SaveOpenAiSettingsDto,
} from '../dto/ai-provider-settings.dto';
import {
  AiProviderSettingsResponseDto,
  GeminiSettingsResponseDto,
  OpenAiSettingsResponseDto,
} from '../dto/ai-provider-settings-response.dto';
import {
  decryptProviderSecret,
  encryptProviderSecret,
  isEncryptedProviderSecret,
  providerSecretKeysFromEnv,
  providerSecretNeedsRotation,
} from '../aiProviderSettings.utils';
import { LessonLlmProvider } from '../providers/lesson-llm.types';

@Injectable()
export class UpdateAiProviderSettingsService {
  constructor(
    private readonly repo: AiProviderSettingRepository,
    private readonly get: GetAiProviderSettingsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Contract with the settings page: omitted `apiKey` preserves the stored
   * secret, an empty string removes it and any other value replaces it.
   */
  private resolveApiKey(
    provider: AiProviderSettingsKey,
    incoming: unknown,
    stored: unknown,
  ): string {
    const raw = typeof stored === 'string' ? stored.trim() : '';
    if (incoming === undefined) {
      if (!raw) return '';
      try {
        // Legacy plaintext, enc:v1 and previous-key values migrate on save.
        return providerSecretNeedsRotation(raw)
          ? encryptProviderSecret(
              decryptProviderSecret(raw, provider),
              provider,
            )
          : raw;
      } catch {
        // Unreadable secret (missing/rotated master key): keep the stored
        // ciphertext untouched instead of overwriting it with an empty value.
        return raw;
      }
    }
    if (typeof incoming !== 'string')
      throw new AppValidationException(
        ErrorCode.VALIDATION_ERROR,
        'O campo apiKey deve ser uma string válida ou omitido.',
      );
    const trimmed = incoming.trim();
    if (!trimmed) return '';
    if (isEncryptedProviderSecret(trimmed))
      throw new AppValidationException(
        ErrorCode.VALIDATION_ERROR,
        'A chave de API informada não é válida.',
      );
    if (this.isProduction() && !providerSecretKeysFromEnv().current)
      throw new AppValidationException(
        ErrorCode.VALIDATION_ERROR,
        `Não é possível salvar uma nova chave de API: ${AI_PROVIDER_SECRET.currentKeyEnv} não está configurada no servidor.`,
      );
    return encryptProviderSecret(trimmed, provider);
  }

  private isProduction(): boolean {
    const environment = (this.config.get<string>('ENVIRONMENT') ?? '')
      .trim()
      .toLowerCase();
    return (
      AI_PROVIDER_SECRET.productionEnvironments as readonly string[]
    ).includes(environment);
  }

  private mergeOpenAi(
    stored: Record<string, unknown> | undefined,
    dto: SaveOpenAiSettingsDto | undefined,
  ): Record<string, unknown> {
    const current = this.get.openAiFromStored(stored);
    delete current.apiKeyUnreadable;
    return {
      ...current,
      ...dto,
      apiKey: this.resolveApiKey(
        AiProviderSettingsKey.OPENAI,
        dto?.apiKey,
        stored?.apiKey,
      ),
    };
  }

  private mergeGemini(
    stored: Record<string, unknown> | undefined,
    dto: SaveGeminiSettingsDto | undefined,
  ): Record<string, unknown> {
    const current = this.get.geminiFromStored(stored);
    delete current.apiKeyUnreadable;
    return {
      ...current,
      ...dto,
      apiKey: this.resolveApiKey(
        AiProviderSettingsKey.GEMINI,
        dto?.apiKey,
        stored?.apiKey,
      ),
    };
  }

  async saveOpenAiSettings(
    dto: SaveOpenAiSettingsDto,
  ): Promise<OpenAiSettingsResponseDto> {
    await this.repo.updateLocked([AiProviderSettingsKey.OPENAI], (current) => ({
      [AiProviderSettingsKey.OPENAI]: this.mergeOpenAi(
        current[AiProviderSettingsKey.OPENAI],
        dto,
      ),
    }));
    return this.get.getOpenAiSettings();
  }

  async saveGeminiSettings(
    dto: SaveGeminiSettingsDto,
  ): Promise<GeminiSettingsResponseDto> {
    await this.repo.updateLocked([AiProviderSettingsKey.GEMINI], (current) => ({
      [AiProviderSettingsKey.GEMINI]: this.mergeGemini(
        current[AiProviderSettingsKey.GEMINI],
        dto,
      ),
    }));
    return this.get.getGeminiSettings();
  }

  async saveSettings(
    dto: SaveAiProviderSettingsDto,
  ): Promise<AiProviderSettingsResponseDto> {
    await this.repo.updateLocked(
      [
        AiProviderSettingsKey.OPENAI,
        AiProviderSettingsKey.GEMINI,
        AiProviderSettingsKey.ACTIVE,
      ],
      (current) => {
        const openai = this.mergeOpenAi(
          current[AiProviderSettingsKey.OPENAI],
          dto.openai,
        );
        const gemini = this.mergeGemini(
          current[AiProviderSettingsKey.GEMINI],
          dto.gemini,
        );
        // The key must be readable, not merely present: a ciphertext the
        // server cannot open would only fail at the first generation.
        const selected =
          dto.llmProvider === LessonLlmProvider.GEMINI
            ? this.get.geminiFromStored(gemini)
            : this.get.openAiFromStored(openai);
        if (selected.apiKeyUnreadable)
          throw new AppValidationException(
            ErrorCode.VALIDATION_ERROR,
            'A chave salva do provedor selecionado não pôde ser lida pelo servidor. Digite a chave novamente antes de ativá-lo.',
          );
        if (!selected.apiKey)
          throw new AppValidationException(
            ErrorCode.VALIDATION_ERROR,
            'Informe a chave de API do provedor selecionado antes de ativá-lo.',
          );
        return {
          [AiProviderSettingsKey.OPENAI]: openai,
          [AiProviderSettingsKey.GEMINI]: gemini,
          [AiProviderSettingsKey.ACTIVE]: { llmProvider: dto.llmProvider },
        };
      },
    );
    return this.get.getSettings();
  }
}
