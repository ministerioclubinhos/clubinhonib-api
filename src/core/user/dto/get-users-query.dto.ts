import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { UserRole } from 'src/core/auth/auth.types';
import {
  toOptionalBoolean,
  toOptionalText,
  toUpperCaseText,
} from 'src/shared/dto/query-transforms';

import {
  SortOrder,
  USERS_DEFAULT_LIMIT,
  USERS_DEFAULT_PAGE,
  USERS_MAX_LIMIT,
  USER_DEFAULT_ORDER,
  USER_DEFAULT_SORT,
  UserSortField,
} from '../constants';

export class GetUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = USERS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(USERS_MAX_LIMIT)
  limit: number = USERS_DEFAULT_LIMIT;

  /** Busca livre por nome, e-mail, telefone ou papel. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalBoolean(value))
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsEnum(UserSortField)
  sort: UserSortField = USER_DEFAULT_SORT;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toUpperCaseText(value))
  @IsEnum(SortOrder)
  order: SortOrder = USER_DEFAULT_ORDER;
}
