import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import {
  toOptionalBoolean,
  toOptionalText,
  toUpperCaseText,
} from 'src/shared/dto/query-transforms';

import {
  CHILDREN_DEFAULT_LIMIT,
  CHILDREN_DEFAULT_ORDER,
  CHILDREN_DEFAULT_PAGE,
  CHILDREN_DEFAULT_SORT,
  CHILDREN_MAX_LIMIT,
  ChildSortField,
  SortOrder,
} from '../constants';

export class QueryChildrenDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  searchString?: string;

  @IsOptional()
  @IsUUID()
  clubId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  clubNumber?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  state?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsDateString()
  birthDateFrom?: string;

  @IsOptional()
  @IsDateString()
  birthDateTo?: string;

  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @IsOptional()
  @IsDateString()
  joinedFrom?: string;

  @IsOptional()
  @IsDateString()
  joinedTo?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(ChildSortField)
  orderBy: ChildSortField = CHILDREN_DEFAULT_SORT;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toUpperCaseText(value))
  @IsEnum(SortOrder)
  order: SortOrder = CHILDREN_DEFAULT_ORDER;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = CHILDREN_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CHILDREN_MAX_LIMIT)
  limit: number = CHILDREN_DEFAULT_LIMIT;
}

export class QueryChildrenSimpleDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  searchString?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsBoolean()
  isActive?: boolean;

  /** Só quem já registrou uma decisão, ou só quem ainda não registrou. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsBoolean()
  acceptedChrist?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = CHILDREN_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CHILDREN_MAX_LIMIT)
  limit: number = CHILDREN_DEFAULT_LIMIT;
}
