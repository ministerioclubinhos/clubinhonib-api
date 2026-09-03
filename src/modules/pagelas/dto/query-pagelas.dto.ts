import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  PAGELAS_DEFAULT_LIMIT,
  PAGELAS_DEFAULT_PAGE,
  PAGELAS_MAX_LIMIT,
  PAGELA_MAX_WEEK,
  PAGELA_MAX_YEAR,
  PAGELA_MIN_WEEK,
  PAGELA_MIN_YEAR,
  PAGELA_SEARCH_MAX_LENGTH,
} from '../constants';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryPagelasDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = PAGELAS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PAGELAS_MAX_LIMIT)
  limit?: number = PAGELAS_DEFAULT_LIMIT;

  @IsOptional()
  @IsUUID()
  childId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGELA_MIN_YEAR)
  @Max(PAGELA_MAX_YEAR)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(PAGELA_MIN_WEEK)
  @Max(PAGELA_MAX_WEEK)
  week?: number;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  present?: boolean;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  didMeditation?: boolean;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  recitedVerse?: boolean;

  /** Busca livre por semana e ano: `2026-48`, `2026` ou `48`. */
  @IsOptional()
  @IsString()
  @MaxLength(PAGELA_SEARCH_MAX_LENGTH)
  searchString?: string;
}
