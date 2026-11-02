import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { LessonLlmProvider } from '../providers/lesson-llm.types';
import {
  AI_PROVIDER_MAX_API_KEY_LENGTH,
  AI_PROVIDER_MAX_MODEL_LENGTH,
  AI_PROVIDER_MAX_OPTION_LENGTH,
  AI_PROVIDER_MAX_RETRIES,
  AI_PROVIDER_MAX_RETRY_DELAY_MS,
} from '../constants/ai-provider-settings.constants';

const trimIfString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class SaveOpenAiSettingsDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_PROVIDER_MAX_MODEL_LENGTH)
  generalModel?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_PROVIDER_MAX_MODEL_LENGTH)
  imageModel?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_PROVIDER_MAX_OPTION_LENGTH)
  imageQuality?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_PROVIDER_MAX_OPTION_LENGTH)
  reasoningEffort?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(AI_PROVIDER_MAX_API_KEY_LENGTH)
  apiKey?: string;
}

export class SaveGeminiSettingsDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_PROVIDER_MAX_MODEL_LENGTH)
  generalModel?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_PROVIDER_MAX_MODEL_LENGTH)
  fallbackModel?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_PROVIDER_MAX_MODEL_LENGTH)
  imageModel?: string;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(AI_PROVIDER_MAX_OPTION_LENGTH)
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

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @Transform(trimIfString)
  @IsString()
  @MaxLength(AI_PROVIDER_MAX_API_KEY_LENGTH)
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
