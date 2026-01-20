import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { DecisionType } from 'src/modules/accepted-christs/enums/decision-type.enum';

export class AcceptedChristsStatsQueryDto {

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;


  @IsOptional()
  @IsString()
  clubId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;


  @IsOptional()
  @IsEnum(DecisionType)
  decision?: DecisionType;


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
  @IsString()
  period?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;
}

