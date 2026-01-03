import { IsOptional, IsInt, Min, Max, IsString, IsBoolean, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { PeriodShortcut } from './period-filter.dto';

export class TeachersStatsQueryDto {
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
  clubId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;

  // Geographic filters
  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  // Activity filters
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
  minEffectivenessScore?: number;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean; // Teve pagela nos últimos 30 dias

  // Sorting
  @IsOptional()
  @IsString()
  sortBy?: string; // "name" | "effectivenessScore" | "totalPagelas" | "presenceRate" | "meditationRate" | "childrenWithDecisions"

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
  @Max(100)
  maxEffectivenessScore?: number; // Score máximo (identificar professores que precisam apoio)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxPresenceRate?: number; // Taxa máxima de presença (identificar problemas)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minDecisions?: number; // Mínimo de crianças com decisões alcançadas

  @IsOptional()
  @IsString()
  search?: string; // Busca por nome do professor
}


