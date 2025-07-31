// src/modules/teacher-profiles/dto/teacher-profiles.query.dto.ts
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/* helpers */
const toBool = (v: any): boolean | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return true;
  if (['false', '0', 'no', 'n'].includes(s)) return false;
  return undefined;
};
const toInt = (v: any): number | undefined => {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
};
const trimOrUndef = (v: any): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t : undefined;
};

export class TeacherProfilesQueryDto {
  /** Busca textual (principal) — nome/email/phone do teacher, e nome/email/phone do coordinator do club dele */
  @IsOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @IsString()
  searchString?: string;

  /** Alias (q) */
  @IsOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @IsString()
  q?: string;

  /** Filtra por ativo (campo do profile) */
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  active?: boolean;

  /** true: somente quem TEM club; false: somente quem NÃO tem club */
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  hasClub?: boolean;

  /** Filtra pelo número do club (tem precedência sobre hasClub) */
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @Type(() => Number)
  @IsInt()
  clubNumber?: number;

  /** Paginação */
  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 12;

  /** Ordenação */
  @IsOptional()
  @IsIn(['updatedAt', 'createdAt', 'name', 'clubNumber'])
  sort: 'updatedAt' | 'createdAt' | 'name' | 'clubNumber' = 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

/** Page DTO genérico (pode mover para um shared, se preferir) */
export class PageDto<T> {
  items!: T[];
  total!: number;
  page!: number;
  limit!: number;
}
