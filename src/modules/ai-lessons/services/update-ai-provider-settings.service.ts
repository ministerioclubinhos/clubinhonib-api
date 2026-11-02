import { Injectable } from '@nestjs/common';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { AiProviderSettingRepository } from '../repositories/ai-provider-setting.repository';
import { AiProviderSettingsKey } from '../constants/ai-provider-settings.constants';
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
import { encryptProviderSecret } from '../aiProviderSettings.utils';

@Injectable()
export class UpdateAiProviderSettingsService {
  constructor(
    private readonly repo: AiProviderSettingRepository,
    private readonly get: GetAiProviderSettingsService,
  ) {}

  private resolveApiKey(incoming: unknown, currentPlaintext: string): string {
    if (incoming === undefined) {
      return encryptProviderSecret(currentPlaintext);
    }
    if (typeof incoming !== 'string') {
      throw new AppValidationException(
        ErrorCode.VALIDATION_ERROR,
        'O campo apiKey deve ser uma string válida ou omitido.',
      );
    }
    return encryptProviderSecret(incoming);
  }

  async saveOpenAiSettings(
    dto: SaveOpenAiSettingsDto,
  ): Promise<OpenAiSettingsResponseDto> {
    const current = await this.get.getInternalOpenAiSettings();
    const apiKey = this.resolveApiKey(dto.apiKey, current.apiKey);
    const updated = {
      ...current,
      ...dto,
      apiKey,
    };
    await this.repo.saveProviderSettings(AiProviderSettingsKey.OPENAI, updated);
    return this.get.getOpenAiSettings();
  }

  async saveGeminiSettings(
    dto: SaveGeminiSettingsDto,
  ): Promise<GeminiSettingsResponseDto> {
    const current = await this.get.getInternalGeminiSettings();
    const apiKey = this.resolveApiKey(dto.apiKey, current.apiKey);
    const updated = {
      ...current,
      ...dto,
      apiKey,
    };
    await this.repo.saveProviderSettings(AiProviderSettingsKey.GEMINI, updated);
    return this.get.getGeminiSettings();
  }

  async saveSettings(
    dto: SaveAiProviderSettingsDto,
  ): Promise<AiProviderSettingsResponseDto> {
    const current = await this.get.getInternalSettings();
    const openaiApiKey = this.resolveApiKey(
      dto.openai?.apiKey,
      current.openai.apiKey,
    );
    const geminiApiKey = this.resolveApiKey(
      dto.gemini?.apiKey,
      current.gemini.apiKey,
    );
    const toSave = {
      llmProvider: dto.llmProvider,
      openai: { ...current.openai, ...dto.openai, apiKey: openaiApiKey },
      gemini: { ...current.gemini, ...dto.gemini, apiKey: geminiApiKey },
    };
    await this.repo.saveAllSettings(toSave);
    return this.get.getSettings();
  }
}
