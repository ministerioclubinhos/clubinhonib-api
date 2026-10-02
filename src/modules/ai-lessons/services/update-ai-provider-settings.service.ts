import { Injectable } from '@nestjs/common';
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

@Injectable()
export class UpdateAiProviderSettingsService {
  constructor(
    private readonly repo: AiProviderSettingRepository,
    private readonly get: GetAiProviderSettingsService,
  ) {}

  async saveOpenAiSettings(
    dto: SaveOpenAiSettingsDto,
  ): Promise<OpenAiSettingsResponseDto> {
    const updated = { ...(await this.get.getOpenAiSettings()), ...dto };
    await this.repo.saveProviderSettings(AiProviderSettingsKey.OPENAI, {
      ...updated,
    });
    return updated;
  }

  async saveGeminiSettings(
    dto: SaveGeminiSettingsDto,
  ): Promise<GeminiSettingsResponseDto> {
    const updated = { ...(await this.get.getGeminiSettings()), ...dto };
    await this.repo.saveProviderSettings(AiProviderSettingsKey.GEMINI, {
      ...updated,
    });
    return updated;
  }

  async saveSettings(
    dto: SaveAiProviderSettingsDto,
  ): Promise<AiProviderSettingsResponseDto> {
    const current = await this.get.getSettings();
    const updated = {
      llmProvider: dto.llmProvider,
      openai: { ...current.openai, ...dto.openai },
      gemini: { ...current.gemini, ...dto.gemini },
    };
    await this.repo.saveAllSettings(updated);
    return updated;
  }
}
