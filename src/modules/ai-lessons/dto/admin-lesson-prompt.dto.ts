import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { LessonCategory, LessonStageType } from '../enums/lesson.enums';

export class SaveAdminLessonPromptDto {
  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @IsOptional()
  @IsEnum(LessonCategory)
  category?: LessonCategory;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(10)
  @MaxLength(12000)
  prompt: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  lockVersion?: number;
}

export class ResetAdminLessonPromptDto {
  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @IsOptional()
  @IsEnum(LessonCategory)
  category?: LessonCategory;

  @IsOptional()
  @IsInt()
  @Min(1)
  lockVersion?: number;
}

export class ListAdminLessonPromptsQueryDto {
  @IsOptional()
  @IsEnum(LessonCategory)
  category?: LessonCategory;
}
