import { Type, Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Max,
  Min,
  IsString,
  IsIn,
  IsBoolean,
} from 'class-validator';

import {
  CLUBS_DEFAULT_LIMIT,
  CLUBS_DEFAULT_PAGE,
  CLUBS_MAX_LIMIT,
  CLUB_DEFAULT_ORDER,
  CLUB_DEFAULT_SORT,
  CLUB_SORT_FIELDS,
} from '../constants';
import { ClubSortField, ClubSortOrder } from '../types';

export class QueryClubsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = CLUBS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CLUBS_MAX_LIMIT)
  limit?: number = CLUBS_DEFAULT_LIMIT;

  @IsOptional()
  @IsString()
  searchString?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean | undefined;
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn(CLUB_SORT_FIELDS)
  sort?: ClubSortField = CLUB_DEFAULT_SORT;

  // A ordem chega da URL em qualquer caixa; normalizar aqui evita espalhar
  // `toUpperCase()` pelo repositório.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: ClubSortOrder = CLUB_DEFAULT_ORDER;
}
