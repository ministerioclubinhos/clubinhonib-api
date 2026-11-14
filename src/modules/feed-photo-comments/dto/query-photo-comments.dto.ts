import { Transform, Type } from 'class-transformer';
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
  PHOTO_COMMENT_DEFAULT_LIMIT,
  PHOTO_COMMENT_DEFAULT_PAGE,
  PHOTO_COMMENT_MAX_LIMIT,
  PHOTO_COMMENT_SEARCH_MAX_LENGTH,
} from '../constants';
import { PhotoCommentStatus } from '../types';
import { trimPhotoCommentText } from '../utils';

export class QueryPhotoCommentsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = PHOTO_COMMENT_DEFAULT_PAGE;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PHOTO_COMMENT_MAX_LIMIT)
  limit: number = PHOTO_COMMENT_DEFAULT_LIMIT;
}

export class QueryPhotoCommentModerationDto extends QueryPhotoCommentsDto {
  @IsOptional()
  @IsEnum(PhotoCommentStatus)
  status?: PhotoCommentStatus;

  @IsOptional()
  @Transform(trimPhotoCommentText)
  @IsString()
  @MaxLength(PHOTO_COMMENT_SEARCH_MAX_LENGTH)
  searchString?: string;
}
