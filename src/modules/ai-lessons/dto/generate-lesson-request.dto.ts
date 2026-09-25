import { IsInt, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class GenerateLessonRequestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  theme: string;

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  biblicalReference: string;

  @IsInt()
  @Min(1)
  weekNumber: number;
}
