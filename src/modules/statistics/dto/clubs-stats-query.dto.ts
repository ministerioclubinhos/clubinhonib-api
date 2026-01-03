import { IsOptional, IsInt, Min, Max, IsString, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PeriodShortcut } from './period-filter.dto';

export class ClubsStatsQueryDto {
  // ⭐ NOVO: Atalho rápido de período
  @IsOptional()
  @IsEnum(PeriodShortcut)
  period?: PeriodShortcut; // 'today' | 'this_week' | 'this_month' | 'last_7_days' | 'last_30_days' | 'this_year' | 'custom'

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
  sortBy?: string; // "number" | "performanceScore" | "totalChildren" | "presenceRate" | "meditationRate" | "totalDecisions"

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

  // ⭐ NOVO: Filtros avançados combinados
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxChildren?: number; // Máximo de crianças (clubes pequenos)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxPresenceRate?: number; // Taxa máxima de presença (identificar clubes com problemas)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxPerformanceScore?: number; // Score máximo (identificar clubes de baixa performance)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDecisions?: number; // Mínimo de decisões alcançadas

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minTeachers?: number; // Mínimo de professores no clube
}


