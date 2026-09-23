import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { LessonStageType, LessonVisualOrientation, LessonVisualType } from '../enums/lesson.enums';

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
  @Min(1)
  @Max(10)
  visualQuantity?: number;
}

export class ReviewStageRequestDto {
  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
