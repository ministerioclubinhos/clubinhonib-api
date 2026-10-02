import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AiProvidersConfigService } from '../services/ai-providers-config.service';
import {
  SaveAiProviderSettingsDto,
  SaveGeminiSettingsDto,
  SaveOpenAiSettingsDto,
} from '../dto/ai-provider-settings.dto';

import { GetAiProviderSettingsService } from '../services/get-ai-provider-settings.service';
import { UpdateAiProviderSettingsService } from '../services/update-ai-provider-settings.service';
import {
  AiProviderModelsResponseDto,
  AiProviderSettingsResponseDto,
  OpenAiSettingsResponseDto,
  GeminiSettingsResponseDto,
} from '../dto/ai-provider-settings-response.dto';

@Controller('api/v1/lessons/providers')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AiProvidersController {
  constructor(
    private readonly service: AiProvidersConfigService,
    private readonly get: GetAiProviderSettingsService,
    private readonly update: UpdateAiProviderSettingsService,
  ) {}

  @Get('settings')
  getSettings(): Promise<AiProviderSettingsResponseDto> {
    return this.get.getSettings();
  }

  @Put('settings')
  saveSettings(
    @Body() dto: SaveAiProviderSettingsDto,
  ): Promise<AiProviderSettingsResponseDto> {
    return this.update.saveSettings(dto);
  }

  @Get('openai/models')
  getOpenAiModels(
    @Query('apiKey') apiKey?: string,
  ): Promise<AiProviderModelsResponseDto> {
    return this.service.getOpenAiModels(apiKey);
  }

  @Get('openai/settings')
  getOpenAiSettings(): Promise<OpenAiSettingsResponseDto> {
    return this.service.getOpenAiSettings();
  }

  @Put('openai/settings')
  saveOpenAiSettings(
    @Body() dto: SaveOpenAiSettingsDto,
  ): Promise<OpenAiSettingsResponseDto> {
    return this.service.saveOpenAiSettings(dto);
  }

  @Get('gemini/models')
  getGeminiModels(): Promise<AiProviderModelsResponseDto> {
    return this.service.getGeminiModels();
  }

  @Get('gemini/settings')
  getGeminiSettings(): Promise<GeminiSettingsResponseDto> {
    return this.service.getGeminiSettings();
  }

  @Put('gemini/settings')
  saveGeminiSettings(
    @Body() dto: SaveGeminiSettingsDto,
  ): Promise<GeminiSettingsResponseDto> {
    return this.service.saveGeminiSettings(dto);
  }
}
