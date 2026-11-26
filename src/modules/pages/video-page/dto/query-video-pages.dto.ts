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
  VIDEO_PAGES_DEFAULT_LIMIT,
  VIDEO_PAGES_DEFAULT_PAGE,
  VIDEO_PAGES_MAX_LIMIT,
  VIDEO_PAGE_DEFAULT_ORDER,
  VIDEO_PAGE_DEFAULT_SORT,
  VIDEO_PAGE_SEARCH_MAX_LENGTH,
  VIDEO_PAGE_SORT_FIELDS,
} from '../constants';
import { VideoPageSortField, VideoPageSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryVideoPagesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = VIDEO_PAGES_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(VIDEO_PAGES_MAX_LIMIT)
  limit?: number = VIDEO_PAGES_DEFAULT_LIMIT;

  /** Busca por título ou trecho da descrição da página. */
  @IsOptional()
  @IsString()
  @MaxLength(VIDEO_PAGE_SEARCH_MAX_LENGTH)
  searchString?: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  public?: boolean;

  @IsOptional()
  @IsIn(VIDEO_PAGE_SORT_FIELDS)
  sort?: VideoPageSortField = VIDEO_PAGE_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: VideoPageSortOrder = VIDEO_PAGE_DEFAULT_ORDER;
}
