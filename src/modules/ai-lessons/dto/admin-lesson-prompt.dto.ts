import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';
import { LessonStageType } from '../enums/lesson.enums';

export class SaveAdminLessonPromptDto {
  @IsEnum(LessonStageType)
  stage: LessonStageType;

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
}
