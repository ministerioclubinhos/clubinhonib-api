import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  PAGELA_MAX_WEEK,
  PAGELA_MAX_YEAR,
  PAGELA_MIN_WEEK,
  PAGELA_MIN_YEAR,
  PAGELA_NOTES_MAX_LENGTH,
} from '../constants';

export class CreatePagelaDto {
  @IsUUID()
  childId: string;

  @IsOptional()
  @IsUUID()
  teacherProfileId?: string | null;

  /** Data do encontro, em `YYYY-MM-DD`. */
  @IsDateString()
  referenceDate: string;

  // Semana e ano são derivados do período letivo quando não vierem; informar
  // só um dos dois faz o outro ser calculado.
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGELA_MIN_WEEK)
  @Max(PAGELA_MAX_WEEK)
  week?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGELA_MIN_YEAR)
  @Max(PAGELA_MAX_YEAR)
  year?: number;

  @IsBoolean()
  present: boolean;

  @IsBoolean()
  didMeditation: boolean;

  @IsBoolean()
  recitedVerse: boolean;

  // O limite acompanha a coluna: sem ele, um texto maior derrubava a gravação.
  @IsOptional()
  @IsString()
  @MaxLength(PAGELA_NOTES_MAX_LENGTH)
  notes?: string | null;
}
