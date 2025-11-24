import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class ClubsStatsQueryDto {
  // Time filters (for pagelas period)
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  startDate?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  endDate?: string; // YYYY-MM-DD

  // Entity filters
  @IsOptional()
  @IsString()
  coordinatorId?: string;

  @IsOptional()
  @IsString()
  weekday?: string; // MONDAY, TUESDAY, etc.

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

  // Performance filters
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

  // Sorting
  @IsOptional()
  @IsString()
  sortBy?: string; // "number" | "performanceScore" | "totalChildren" | "presenceRate"

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC';

  // Pagination
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
}


