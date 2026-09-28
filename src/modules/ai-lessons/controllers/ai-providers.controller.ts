import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/core/auth/guards/jwt-auth.guard';
import { AdminRoleGuard } from 'src/core/auth/guards/role-guard';
import { AiProvidersConfigService } from '../services/ai-providers-config.service';
import { SaveGeminiSettingsDto, SaveOpenAiSettingsDto } from '../dto/ai-provider-settings.dto';

@Controller('api/v1/lessons/providers')
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class AiProvidersController {
  constructor(private readonly service: AiProvidersConfigService) {}

  @Get('openai/models')
  getOpenAiModels(@Query('apiKey') apiKey?: string) {
    return this.service.getOpenAiModels(apiKey);
  }

  @Get('openai/settings')
  getOpenAiSettings() {
    return this.service.getOpenAiSettings();
  }

  @Put('openai/settings')
  saveOpenAiSettings(@Body() dto: SaveOpenAiSettingsDto) {
    return this.service.saveOpenAiSettings(dto);
  }

  @Get('gemini/models')
  getGeminiModels() {
    return this.service.getGeminiModels();
  }

  @Get('gemini/settings')
  getGeminiSettings() {
    return this.service.getGeminiSettings();
  }

  @Put('gemini/settings')
  saveGeminiSettings(@Body() dto: SaveGeminiSettingsDto) {
    return this.service.saveGeminiSettings(dto);
  }
}
