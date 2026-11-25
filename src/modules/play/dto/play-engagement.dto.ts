import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Max,
  Min,
} from 'class-validator';
import {
  PLAY_CATEGORY_NAME_MAX_LENGTH,
  PLAY_MAX_DURATION_SECONDS,
  PLAY_RELATED_MAX_LIMIT,
  PLAY_STATS_MAX_LIMIT,
} from '../constants';

export class SavePlayProgressDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(PLAY_MAX_DURATION_SECONDS)
  positionSeconds: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PLAY_MAX_DURATION_SECONDS)
  durationSeconds?: number;
}

export class SavePlayCategoryDto {
  @IsString({ message: 'O nome da categoria deve ser um texto.' })
  @Matches(/\S/, { message: 'O nome da categoria não pode ficar vazio.' })
  @MaxLength(PLAY_CATEGORY_NAME_MAX_LENGTH, {
    message: 'Use até 100 caracteres.',
  })
  name: string;
}

export class QueryPlayRelatedDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PLAY_RELATED_MAX_LIMIT)
  limit?: number;
}

export class QueryPlayStatsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PLAY_STATS_MAX_LIMIT)
  limit?: number;
}
