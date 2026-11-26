import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsBoolean,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { PeriodShortcut } from './period-filter.dto';
import { parseStrictBoolean } from './query-transformers';

export class PagelasStatsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  clubId?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  coordinatorId?: string;

  @IsOptional()
  @IsEnum(['M', 'F'])
  gender?: 'M' | 'F';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minAge?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxAge?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsDateString()
  joinedAfter?: string;

  @IsOptional()
  @IsDateString()
  joinedBefore?: string;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  onlyPresent?: boolean;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  onlyDidMeditation?: boolean;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  onlyRecitedVerse?: boolean;

  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'])
  groupBy?: 'day' | 'week' | 'month' | 'year';

  @IsOptional()
  @IsEnum(PeriodShortcut)
  period?: PeriodShortcut;
}
