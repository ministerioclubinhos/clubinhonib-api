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
import { DecisionType } from 'src/modules/accepted-christs/enums/decision-type.enum';
import { parseStrictBoolean } from './query-transformers';

export class ChildrenStatsQueryDto {
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
  @IsEnum(['0-5', '6-10', '11-15', '16+'])
  ageGroup?: '0-5' | '6-10' | '11-15' | '16+';

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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPagelas?: number;

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
  minEngagementScore?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxEngagementScore?: number;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  hasDecision?: boolean;

  @IsOptional()
  @IsEnum(DecisionType)
  decisionType?: DecisionType;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(['name', 'age', 'engagementScore', 'presenceRate'])
  sortBy?: 'name' | 'age' | 'engagementScore' | 'presenceRate';

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

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  hasLowEngagement?: boolean;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  isNewcomer?: boolean;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  isVeteran?: boolean;
}
