import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  WEEK_MATERIALS_DEFAULT_LIMIT,
  WEEK_MATERIALS_DEFAULT_PAGE,
  WEEK_MATERIALS_MAX_LIMIT,
  WEEK_MATERIAL_DEFAULT_ORDER,
  WEEK_MATERIAL_DEFAULT_SORT,
  WEEK_MATERIAL_SEARCH_MAX_LENGTH,
  WEEK_MATERIAL_SORT_FIELDS,
} from '../constants';
import { WeekMaterialSortField, WeekMaterialSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryWeekMaterialsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = WEEK_MATERIALS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(WEEK_MATERIALS_MAX_LIMIT)
  limit?: number = WEEK_MATERIALS_DEFAULT_LIMIT;

  /** Busca por título, subtítulo ou trecho da descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(WEEK_MATERIAL_SEARCH_MAX_LENGTH)
  searchString?: string;

  /** `true` traz apenas a página publicada como material da semana. */
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  currentWeek?: boolean;

  @IsOptional()
  @IsIn(WEEK_MATERIAL_SORT_FIELDS)
  sort?: WeekMaterialSortField = WEEK_MATERIAL_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: WeekMaterialSortOrder = WEEK_MATERIAL_DEFAULT_ORDER;
}
