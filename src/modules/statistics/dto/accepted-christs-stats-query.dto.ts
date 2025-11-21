import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DecisionType } from 'src/modules/accepted-christs/enums/decision-type.enum';

export class AcceptedChristsStatsQueryDto {
  // Time filters
  @IsOptional()
  @IsString()
  startDate?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  endDate?: string; // YYYY-MM-DD

  // Entity filters
  @IsOptional()
  @IsString()
  clubId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;

  // Decision filter
  @IsOptional()
  @IsEnum(DecisionType)
  decision?: DecisionType;

  // Child demographic filters
  @IsOptional()
  @IsString()
  gender?: string;

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

  // Geographic filters
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  district?: string;

  // Participation time filters
  @IsOptional()
  @IsString()
  joinedAfter?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  joinedBefore?: string; // YYYY-MM-DD

  // Grouping for charts
  @IsOptional()
  @IsEnum(['day', 'week', 'month', 'year'])
  groupBy?: 'day' | 'week' | 'month' | 'year';
}

