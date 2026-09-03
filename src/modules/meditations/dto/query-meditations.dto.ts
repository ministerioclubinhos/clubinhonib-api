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
  MEDITATIONS_DEFAULT_LIMIT,
  MEDITATIONS_DEFAULT_PAGE,
  MEDITATIONS_MAX_LIMIT,
  MEDITATION_DEFAULT_ORDER,
  MEDITATION_DEFAULT_SORT,
  MEDITATION_PERIOD_FILTERS,
  MEDITATION_SEARCH_MAX_LENGTH,
  MEDITATION_SORT_FIELDS,
} from '../constants';
import {
  MeditationPeriodFilter,
  MeditationSortField,
  MeditationSortOrder,
} from '../types';

export class QueryMeditationsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = MEDITATIONS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MEDITATIONS_MAX_LIMIT)
  limit?: number = MEDITATIONS_DEFAULT_LIMIT;

  /** Busca pelo tema da semana ou pelo tema/versículo de algum dia. */
  @IsOptional()
  @IsString()
  @MaxLength(MEDITATION_SEARCH_MAX_LENGTH)
  searchString?: string;

  /** `current` cobre hoje, `upcoming` começa depois, `past` já terminou. */
  @IsOptional()
  @IsIn(MEDITATION_PERIOD_FILTERS)
  period?: MeditationPeriodFilter;

  @IsOptional()
  @IsIn(MEDITATION_SORT_FIELDS)
  sort?: MeditationSortField = MEDITATION_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: MeditationSortOrder = MEDITATION_DEFAULT_ORDER;
}
