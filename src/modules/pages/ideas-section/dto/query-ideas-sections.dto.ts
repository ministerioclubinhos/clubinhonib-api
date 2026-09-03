import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  IDEAS_SECTIONS_DEFAULT_LIMIT,
  IDEAS_SECTIONS_DEFAULT_PAGE,
  IDEAS_SECTIONS_MAX_LIMIT,
  IDEAS_SECTION_DEFAULT_ORDER,
  IDEAS_SECTION_DEFAULT_SORT,
  IDEAS_SECTION_SEARCH_MAX_LENGTH,
  IDEAS_SECTION_SORT_FIELDS,
} from '../constants';
import { IdeasSectionSortField, IdeasSectionSortOrder } from '../types';

export class QueryIdeasSectionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = IDEAS_SECTIONS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(IDEAS_SECTIONS_MAX_LIMIT)
  limit?: number = IDEAS_SECTIONS_DEFAULT_LIMIT;

  /** Busca por título ou trecho da descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(IDEAS_SECTION_SEARCH_MAX_LENGTH)
  searchString?: string;

  @IsOptional()
  @IsIn(IDEAS_SECTION_SORT_FIELDS)
  sort?: IdeasSectionSortField = IDEAS_SECTION_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: IdeasSectionSortOrder = IDEAS_SECTION_DEFAULT_ORDER;
}
