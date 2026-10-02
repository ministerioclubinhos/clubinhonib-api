import { Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { LessonLlmProvider } from '../providers/lesson-llm.types';
import {
  AI_PROVIDER_MAX_RETRIES,
  AI_PROVIDER_MAX_RETRY_DELAY_MS,
} from '../constants/ai-provider-settings.constants';

export class SaveOpenAiSettingsDto {
  @IsOptional()
  @IsString()
  generalModel?: string;

  @IsOptional()
  @IsString()
  imageModel?: string;

  @IsOptional()
  @IsString()
  imageQuality?: string;

  @IsOptional()
  @IsString()
  reasoningEffort?: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class SaveGeminiSettingsDto {
  @IsOptional()
  @IsString()
  generalModel?: string;

  @IsOptional()
  @IsString()
  fallbackModel?: string;

  @IsOptional()
  @IsString()
  imageModel?: string;

  @IsOptional()
  @IsString()
  imageSize?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(AI_PROVIDER_MAX_RETRIES)
  maxRetries?: number;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(AI_PROVIDER_MAX_RETRY_DELAY_MS)
  retryBaseDelayMs?: number;

  @IsOptional()
  @IsString()
  apiKey?: string;
}

export class SaveAiProviderSettingsDto {
  @IsEnum(LessonLlmProvider)
  llmProvider: LessonLlmProvider;

  @IsDefined()
  @ValidateNested()
  @Type(() => SaveOpenAiSettingsDto)
  openai: SaveOpenAiSettingsDto;

  @IsDefined()
  @ValidateNested()
  @Type(() => SaveGeminiSettingsDto)
  gemini: SaveGeminiSettingsDto;
}
