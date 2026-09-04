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
  COORDINATORS_DEFAULT_LIMIT,
  COORDINATORS_DEFAULT_ORDER,
  COORDINATORS_DEFAULT_PAGE,
  COORDINATORS_DEFAULT_SORT,
  COORDINATORS_MAX_LIMIT,
  CoordinatorSortField,
  SortOrder,
} from '../constants';

export class CoordinatorProfilesQueryDto {
  /** Busca livre por coordenador, clubinho ou professor vinculado. */
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
  hasClubs?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clubNumber?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = COORDINATORS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COORDINATORS_MAX_LIMIT)
  limit: number = COORDINATORS_DEFAULT_LIMIT;

  @IsOptional()
  @IsEnum(CoordinatorSortField)
  sort: CoordinatorSortField = COORDINATORS_DEFAULT_SORT;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toLowerCaseText(value))
  @IsEnum(SortOrder)
  order: SortOrder = COORDINATORS_DEFAULT_ORDER;
}

/** Uma página de resultados. */
export class PageDto<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
