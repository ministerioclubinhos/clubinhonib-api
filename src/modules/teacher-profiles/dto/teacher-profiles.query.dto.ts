import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  toLowerCaseText,
  toOptionalBoolean,
  toOptionalText,
} from 'src/shared/dto/query-transforms';

import {
  SortOrder,
  TEACHERS_DEFAULT_LIMIT,
  TEACHERS_DEFAULT_ORDER,
  TEACHERS_DEFAULT_PAGE,
  TEACHERS_DEFAULT_SORT,
  TEACHERS_MAX_LIMIT,
  TeacherSortField,
} from '../constants';

export class TeacherProfilesQueryDto {
  /** Busca livre por professor, clubinho ou coordenador. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  searchString?: string;

  /** Alias histórico de `searchString`; os dois filtram o mesmo. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsBoolean()
  hasClub?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clubNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = TEACHERS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TEACHERS_MAX_LIMIT)
  limit: number = TEACHERS_DEFAULT_LIMIT;

  @IsOptional()
  @IsEnum(TeacherSortField)
  sort: TeacherSortField = TEACHERS_DEFAULT_SORT;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toLowerCaseText(value))
  @IsEnum(SortOrder)
  order: SortOrder = TEACHERS_DEFAULT_ORDER;
}

/** Uma página de resultados. */
export class PageDto<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
