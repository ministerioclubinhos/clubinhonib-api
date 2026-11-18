import {
  IsOptional,
  IsString,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DecisionType } from 'src/modules/accepted-christs/enums/decision-type.enum';
import { PeriodShortcut } from './period-filter.dto';

export class AcceptedChristsStatsQueryDto {
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
  @IsEnum(DecisionType)
  decision?: DecisionType;

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
  @IsString()
  joinedAfter?: string;

  @IsOptional()
  @IsString()
  joinedBefore?: string;

  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'])
  groupBy?: 'day' | 'week' | 'month' | 'year';

  @IsOptional()
  @IsEnum(PeriodShortcut)
  period?: PeriodShortcut;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;
}
