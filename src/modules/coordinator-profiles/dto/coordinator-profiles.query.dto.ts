// src/modules/coordinator-profiles/dto/coordinator-profiles.query.dto.ts
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/* ---------- helpers ---------- */
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

export class CoordinatorProfilesQueryDto {
  /** Busca textual (principal) */
  @IsOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @IsString()
  searchString?: string;

  /** Alias compatível (q) */
  @IsOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @IsString()
  q?: string;

  /** Filtra por ativo (campo do profile) */
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  active?: boolean;

  /** true: só quem tem clube; false: só quem NÃO tem clube */
  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  hasClubs?: boolean;

  /** Filtra coordenadores que possuem o clube com este número */
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
  @IsIn(['updatedAt', 'createdAt', 'name'])
  sort: 'updatedAt' | 'createdAt' | 'name' = 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

/** ✅ Exporte isto para satisfazer os imports no controller/service */
export class PageDto<T> {
  items!: T[];
  total!: number;
  page!: number;
  limit!: number;
}
