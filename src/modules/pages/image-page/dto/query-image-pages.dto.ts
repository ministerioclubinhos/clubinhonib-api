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
  IMAGE_PAGES_DEFAULT_LIMIT,
  IMAGE_PAGES_DEFAULT_PAGE,
  IMAGE_PAGES_MAX_LIMIT,
  IMAGE_PAGE_DEFAULT_ORDER,
  IMAGE_PAGE_DEFAULT_SORT,
  IMAGE_PAGE_SEARCH_MAX_LENGTH,
  IMAGE_PAGE_SORT_FIELDS,
} from '../constants';
import { ImagePageSortField, ImagePageSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryImagePagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = IMAGE_PAGES_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(IMAGE_PAGES_MAX_LIMIT)
  limit?: number = IMAGE_PAGES_DEFAULT_LIMIT;

  /** Busca por título ou trecho da descrição da galeria. */
  @IsOptional()
  @IsString()
  @MaxLength(IMAGE_PAGE_SEARCH_MAX_LENGTH)
  searchString?: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  public?: boolean;

  @IsOptional()
  @IsIn(IMAGE_PAGE_SORT_FIELDS)
  sort?: ImagePageSortField = IMAGE_PAGE_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: ImagePageSortOrder = IMAGE_PAGE_DEFAULT_ORDER;
}
