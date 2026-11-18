import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  IMAGE_SECTIONS_DEFAULT_LIMIT,
  IMAGE_SECTIONS_DEFAULT_PAGE,
  IMAGE_SECTIONS_MAX_LIMIT,
  IMAGE_SECTION_DEFAULT_ORDER,
  IMAGE_SECTION_DEFAULT_SORT,
  IMAGE_SECTION_SEARCH_MAX_LENGTH,
  IMAGE_SECTION_SORT_FIELDS,
} from '../constants';
import { ImageSectionSortField, ImageSectionSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryImageSectionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = IMAGE_SECTIONS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(IMAGE_SECTIONS_MAX_LIMIT)
  limit?: number = IMAGE_SECTIONS_DEFAULT_LIMIT;

  /** Busca por legenda ou trecho da descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(IMAGE_SECTION_SEARCH_MAX_LENGTH)
  searchString?: string;

  /**
   * `false` traz a fila de aprovação; `true`, as já publicadas.
   *
   * Sem o filtro, a listagem devolve as duas — a administração precisa
   * enxergar o que já aprovou.
   */
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  /** Só as que têm foto, ou só as que ficaram sem. */
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  hasMedia?: boolean;

  @IsOptional()
  @IsIn(IMAGE_SECTION_SORT_FIELDS)
  sort?: ImageSectionSortField = IMAGE_SECTION_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: ImageSectionSortOrder = IMAGE_SECTION_DEFAULT_ORDER;
}
