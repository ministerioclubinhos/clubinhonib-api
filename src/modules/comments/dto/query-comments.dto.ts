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
  COMMENTS_DEFAULT_LIMIT,
  COMMENTS_DEFAULT_PAGE,
  COMMENTS_MAX_LIMIT,
  COMMENT_DEFAULT_ORDER,
  COMMENT_DEFAULT_SORT,
  COMMENT_SEARCH_MAX_LENGTH,
  COMMENT_SORT_FIELDS,
} from '../constants';
import { CommentSortField, CommentSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryCommentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = COMMENTS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(COMMENTS_MAX_LIMIT)
  limit?: number = COMMENTS_DEFAULT_LIMIT;

  /** Busca por nome, clubinho, bairro ou trecho do comentário. */
  @IsOptional()
  @IsString()
  @MaxLength(COMMENT_SEARCH_MAX_LENGTH)
  searchString?: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn(COMMENT_SORT_FIELDS)
  sort?: CommentSortField = COMMENT_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: CommentSortOrder = COMMENT_DEFAULT_ORDER;
}
