import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  LessonStageType,
  LessonVisualOrientation,
  LessonVisualType,
} from '../enums/lesson.enums';

export interface FrozenAttemptProviderConfig {
  provider: string;
  textModel: string;
  imageModel: string;
}

export class GenerateStageRequestDto {
  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  revisionInstructions?: string;

  @IsOptional()
  @IsEnum(LessonVisualType)
  visualType?: LessonVisualType;

  @IsOptional()
  @IsEnum(LessonVisualOrientation)
  visualOrientation?: LessonVisualOrientation;

  @IsOptional()
  @IsInt()
  @Min(4)
  @Max(10)
  visualQuantity?: number;

  @IsOptional()
  frozenProvider?: FrozenAttemptProviderConfig;

  @IsOptional()
  @IsString()
  frozenAdminPrompt?: string;

  @IsOptional()
  checkpointedAssetUrls?: string[];
}

export class ReviewStageRequestDto {
  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class PreviewStagePdfQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  lockVersion?: number;

  @IsOptional()
  @IsString()
  @MaxLength(36)
  versionId?: string;
}
