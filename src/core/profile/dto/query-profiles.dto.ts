import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

import { UserRole } from 'src/core/auth/auth.types';
import { toOptionalText } from 'src/shared/dto/query-transforms';

import {
  PROFILES_DEFAULT_LIMIT,
  PROFILES_DEFAULT_PAGE,
  PROFILES_MAX_LIMIT,
  PROFILE_DEFAULT_ORDER,
  PROFILE_DEFAULT_SORT,
  ProfileSortField,
  ProfileSortOrder,
} from '../constants';

export class QueryProfilesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = PROFILES_DEFAULT_PAGE;

  /**
   * O teto existe para a listagem não virar um despejo do banco: a tela pedia
   * mil perfis completos de uma vez para montar a faixa de aniversariantes.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PROFILES_MAX_LIMIT)
  limit: number = PROFILES_DEFAULT_LIMIT;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  q?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  name?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  loveLanguages?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  temperaments?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => toOptionalText(value))
  @IsString()
  favoriteColor?: string;

  @IsOptional()
  @IsEnum(ProfileSortField)
  sortBy: ProfileSortField = PROFILE_DEFAULT_SORT;

  @IsOptional()
  @IsEnum(ProfileSortOrder)
  order: ProfileSortOrder = PROFILE_DEFAULT_ORDER;
}
