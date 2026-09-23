import { IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { LessonStageType } from '../enums/lesson.enums';

export class SaveTiptapContentDto {
  @IsObject()
  tiptapAstJson: Record<string, unknown>;

  @IsObject()
  @IsOptional()
  structuredDataJson?: Record<string, unknown>;

  @IsEnum(LessonStageType)
  stage: LessonStageType;

  @IsInt()
  @Min(1)
  lockVersion: number;

  @IsString()
  @IsOptional()
  changeSummary?: string;
}
