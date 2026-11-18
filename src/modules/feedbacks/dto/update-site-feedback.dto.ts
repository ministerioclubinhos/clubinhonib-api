import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  FEEDBACK_COMMENT_MAX_LENGTH,
  FEEDBACK_MAX_RATING,
  FEEDBACK_MIN_RATING,
} from '../constants';
import { FeedbackCategory } from '../entities/feedback-category.enum';

/** Edição da avaliação. Todo campo é opcional: altera-se só o que mudou. */
export class UpdateSiteFeedbackDto {
  @IsOptional()
  @IsInt()
  @Min(FEEDBACK_MIN_RATING)
  @Max(FEEDBACK_MAX_RATING)
  rating?: number;

  @IsOptional()
  @IsString()
  @MaxLength(FEEDBACK_COMMENT_MAX_LENGTH)
  comment?: string;

  @IsOptional()
  @IsEnum(FeedbackCategory)
  category?: FeedbackCategory;
}
