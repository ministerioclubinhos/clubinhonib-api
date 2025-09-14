import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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
  @IsOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @IsString()
  searchString?: string;

  @IsOptional()
  @Transform(({ value }) => trimOrUndef(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }) => toBool(value))
  @IsBoolean()
  hasClub?: boolean;

  @IsOptional()
  @Transform(({ value }) => toInt(value))
  @Type(() => Number)
  @IsInt()
  clubNumber?: number;

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

  @IsOptional()
  @IsIn(['updatedAt', 'createdAt', 'name', 'clubNumber'])
  sort: 'updatedAt' | 'createdAt' | 'name' | 'clubNumber' = 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order: 'asc' | 'desc' = 'desc';
}

export class PageDto<T> {
  items!: T[];
  total!: number;
  page!: number;
  limit!: number;
}
