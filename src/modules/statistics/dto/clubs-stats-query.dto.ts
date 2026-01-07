import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PeriodShortcut } from './period-filter.dto';

export class ClubsStatsQueryDto {
  
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
  @IsString()
  startDate?: string; 

  @IsOptional()
  @IsString()
  endDate?: string; 

  
  @IsOptional()
  @IsString()
  coordinatorId?: string;

  @IsOptional()
  @IsString()
  weekday?: string; 

  
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
  minPerformanceScore?: number;

  
  @IsOptional()
  @IsString()
  sortBy?: string; 

  @IsOptional()
  @IsString()
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
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxChildren?: number; 

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
  maxPerformanceScore?: number; 

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDecisions?: number; 

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minTeachers?: number; 
}


