import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsBoolean,
  IsEnum,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { PeriodShortcut } from './period-filter.dto';
import { parseStrictBoolean } from './query-transformers';

export class TeachersStatsQueryDto {
  @IsOptional()
  @IsEnum(PeriodShortcut)
  period?: PeriodShortcut;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

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
  coordinatorId?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPagelas?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minChildren?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minPresenceRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxPresenceRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minEffectivenessScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxEffectivenessScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDecisions?: number;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(['name', 'effectivenessScore', 'presenceRate', 'totalChildren'])
  sortBy?: 'name' | 'effectivenessScore' | 'presenceRate' | 'totalChildren';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}
