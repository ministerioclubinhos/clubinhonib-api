import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlaySort } from '../enums/play-sort.enum';
import {
  PLAY_DEFAULT_LIMIT,
  PLAY_DEFAULT_PAGE,
  PLAY_MAX_LIMIT,
  PLAY_SEARCH_MAX_LENGTH,
} from '../constants';

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryPlayVideosDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = PLAY_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PLAY_MAX_LIMIT)
  limit?: number = PLAY_DEFAULT_LIMIT;

  /** Busca por título, descrição, galeria ou categoria. */
  @IsOptional()
  @IsString()
  @MaxLength(PLAY_SEARCH_MAX_LENGTH)
  search?: string;

  @IsOptional()
  @IsUUID()
  galleryId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  /** Só os favoritos de quem pergunta. */
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  favorites?: boolean;

  /** Só os que o professor começou e não terminou. */
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  inProgress?: boolean;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  featured?: boolean;

  @IsOptional()
  @IsEnum(PlaySort)
  sort?: PlaySort = PlaySort.CURATED;
}
