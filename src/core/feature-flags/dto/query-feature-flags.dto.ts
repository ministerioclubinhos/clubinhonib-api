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
  FEATURE_FLAGS_DEFAULT_LIMIT,
  FEATURE_FLAGS_DEFAULT_PAGE,
  FEATURE_FLAGS_MAX_LIMIT,
  FEATURE_FLAG_AUDIENCES,
  FEATURE_FLAG_DEFAULT_ORDER,
  FEATURE_FLAG_DEFAULT_SORT,
  FEATURE_FLAG_SEARCH_MAX_LENGTH,
  FEATURE_FLAG_SORT_FIELDS,
} from '../constants';
import {
  FeatureFlagAudience,
  FeatureFlagSortField,
  FeatureFlagSortOrder,
} from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryFeatureFlagsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = FEATURE_FLAGS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEATURE_FLAGS_MAX_LIMIT)
  limit?: number = FEATURE_FLAGS_DEFAULT_LIMIT;

  /** Busca por chave, nome ou trecho da descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(FEATURE_FLAG_SEARCH_MAX_LENGTH)
  searchString?: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  /** Recorte por combinação de perfis. */
  @IsOptional()
  @IsIn(FEATURE_FLAG_AUDIENCES)
  audience?: FeatureFlagAudience;

  @IsOptional()
  @IsIn(FEATURE_FLAG_SORT_FIELDS)
  sort?: FeatureFlagSortField = FEATURE_FLAG_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: FeatureFlagSortOrder = FEATURE_FLAG_DEFAULT_ORDER;
}
