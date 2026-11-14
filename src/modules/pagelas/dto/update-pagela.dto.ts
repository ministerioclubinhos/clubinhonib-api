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
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  PAGELA_MAX_WEEK,
  PAGELA_MAX_YEAR,
  PAGELA_MIN_WEEK,
  PAGELA_MIN_YEAR,
  PAGELA_NOTES_MAX_LENGTH,
} from '../constants';

export class UpdatePagelaDto {
  // `null` desvincula o professor que registrou.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  teacherProfileId?: string | null;

  @IsOptional()
  @IsDateString()
  referenceDate?: string;

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

  @IsOptional()
  @IsBoolean()
  present?: boolean;

  @IsOptional()
  @IsBoolean()
  didMeditation?: boolean;

  @IsOptional()
  @IsBoolean()
  recitedVerse?: boolean;

  // `null` limpa a observação.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(PAGELA_NOTES_MAX_LENGTH)
  notes?: string | null;
}
