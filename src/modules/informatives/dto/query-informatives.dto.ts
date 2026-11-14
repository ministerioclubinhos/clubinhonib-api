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
  INFORMATIVES_DEFAULT_LIMIT,
  INFORMATIVES_DEFAULT_PAGE,
  INFORMATIVES_MAX_LIMIT,
  INFORMATIVE_DEFAULT_ORDER,
  INFORMATIVE_DEFAULT_SORT,
  INFORMATIVE_SEARCH_MAX_LENGTH,
  INFORMATIVE_SORT_FIELDS,
} from '../constants';
import { InformativeSortField, InformativeSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryInformativesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = INFORMATIVES_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(INFORMATIVES_MAX_LIMIT)
  limit?: number = INFORMATIVES_DEFAULT_LIMIT;

  /** Busca por título ou trecho da descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(INFORMATIVE_SEARCH_MAX_LENGTH)
  searchString?: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  public?: boolean;

  @IsOptional()
  @IsIn(INFORMATIVE_SORT_FIELDS)
  sort?: InformativeSortField = INFORMATIVE_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: InformativeSortOrder = INFORMATIVE_DEFAULT_ORDER;
}
