import {
  IsOptional,
  IsInt,
  Min,
  Max,
  IsString,
  IsEnum,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Transform } from 'class-transformer';
import { PeriodShortcut } from './period-filter.dto';

export class ChildrenStatsQueryDto {
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
  teacherId?: string;

  @IsOptional()
  @IsString()
  coordinatorId?: string;

  // Child demographic filters
  @IsOptional()
  @IsString()
  gender?: string; // 'M' | 'F'

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
  ageGroup?: string; // "0-5", "6-10", "11-15", "16+"

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

  // Participation filters
  @IsOptional()
  @IsString()
  joinedAfter?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  joinedBefore?: string; // YYYY-MM-DD

  // Activity filters
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPagelas?: number; // Mínimo de pagelas

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minPresenceRate?: number; // Taxa mínima de presença

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minEngagementScore?: number; // Score mínimo de engajamento

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasDecision?: boolean; // Tem decisão?

  @IsOptional()
  @IsString()
  decisionType?: string; // "ACCEPTED" | "RECONCILED"

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean; // Teve pagela nos últimos 30 dias

  // Sorting
  @IsOptional()
  @IsString()
  sortBy?: string; // "name" | "age" | "engagementScore" | "totalPagelas" | "presenceRate" | "joinedAt" | "lastPagelaDate"

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
  @IsString()
  search?: string; // Busca por nome da criança

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasLowEngagement?: boolean; // Crianças com engajamento < 50%

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isNewcomer?: boolean; // Crianças que entraram nos últimos 3 meses

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isVeteran?: boolean; // Crianças com mais de 1 ano de participação

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxEngagementScore?: number; // Score máximo de engajamento (para encontrar crianças em risco)

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  maxPresenceRate?: number; // Taxa máxima de presença (para encontrar crianças faltosas)
}
