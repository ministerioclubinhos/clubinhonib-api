import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  FEEDBACKS_DEFAULT_LIMIT,
  FEEDBACKS_DEFAULT_PAGE,
  FEEDBACKS_MAX_LIMIT,
  FEEDBACK_DEFAULT_ORDER,
  FEEDBACK_DEFAULT_SORT,
  FEEDBACK_MAX_RATING,
  FEEDBACK_MIN_RATING,
  FEEDBACK_SEARCH_MAX_LENGTH,
  FEEDBACK_SORT_FIELDS,
} from '../constants';
import { FeedbackCategory } from '../entities/feedback-category.enum';
import { FeedbackSortField, FeedbackSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryFeedbacksDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = FEEDBACKS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(FEEDBACKS_MAX_LIMIT)
  limit?: number = FEEDBACKS_DEFAULT_LIMIT;

  /** Busca por nome, e-mail ou trecho do comentário. */
  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_SEARCH_MAX_LENGTH)
  searchString?: string;

  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  /** Nota exata da avaliação. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(FEEDBACK_MIN_RATING)
  @Max(FEEDBACK_MAX_RATING)
  rating?: number;

  @IsOptional()
  @IsIn(FEEDBACK_SORT_FIELDS)
  sort?: FeedbackSortField = FEEDBACK_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: FeedbackSortOrder = FEEDBACK_DEFAULT_ORDER;
}
