import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { LessonCategory } from '../enums/lesson.enums';

export class GenerateLessonRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  theme: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  biblicalReference: string;

  @IsOptional()
  @IsEnum(LessonCategory)
  category?: LessonCategory;

  // Obrigatório no Material Semanal; opcional no Material Especial.
  @ValidateIf(
    (o: GenerateLessonRequestDto) =>
      (o.category ?? LessonCategory.REGULAR) === LessonCategory.REGULAR ||
      (o.weekNumber !== undefined && o.weekNumber !== null),
  )
  @IsInt()
  @Min(1)
  weekNumber?: number | null;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? null : trimmed;
  })
  @IsString()
  @MaxLength(2000)
  specialContext?: string | null;
}
