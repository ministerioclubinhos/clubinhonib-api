import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateLessonRequestDto {
  @IsString()
  @MinLength(3)
  theme: string;

  @IsString()
  @MinLength(3)
  biblicalReference: string;

  @IsInt()
  @IsOptional()
  weekNumber?: number;

  @IsString()
  @IsOptional()
  customNotes?: string;
}
