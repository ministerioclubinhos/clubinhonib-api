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
  IDEAS_PAGES_DEFAULT_LIMIT,
  IDEAS_PAGES_DEFAULT_PAGE,
  IDEAS_PAGES_MAX_LIMIT,
  IDEAS_PAGE_DEFAULT_ORDER,
  IDEAS_PAGE_DEFAULT_SORT,
  IDEAS_PAGE_SEARCH_MAX_LENGTH,
  IDEAS_PAGE_SORT_FIELDS,
} from '../constants';
import { IdeasPageSortField, IdeasPageSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryIdeasPagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = IDEAS_PAGES_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(IDEAS_PAGES_MAX_LIMIT)
  limit?: number = IDEAS_PAGES_DEFAULT_LIMIT;

  /** Busca por título, subtítulo ou trecho da descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(IDEAS_PAGE_SEARCH_MAX_LENGTH)
  searchString?: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  public?: boolean;

  @IsOptional()
  @IsIn(IDEAS_PAGE_SORT_FIELDS)
  sort?: IdeasPageSortField = IDEAS_PAGE_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: IdeasPageSortOrder = IDEAS_PAGE_DEFAULT_ORDER;
}
