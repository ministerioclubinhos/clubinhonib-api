import { IsNumber, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  @IsNumber()
  maxRetries?: number;

  @IsOptional()
  @IsNumber()
  retryBaseDelayMs?: number;

  @IsOptional()
  @IsString()
  apiKey?: string;
}
