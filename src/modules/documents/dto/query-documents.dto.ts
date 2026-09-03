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
  DOCUMENTS_DEFAULT_LIMIT,
  DOCUMENTS_DEFAULT_PAGE,
  DOCUMENTS_MAX_LIMIT,
  DOCUMENT_DEFAULT_ORDER,
  DOCUMENT_DEFAULT_SORT,
  DOCUMENT_SEARCH_MAX_LENGTH,
  DOCUMENT_SORT_FIELDS,
} from '../constants';
import { DocumentSortField, DocumentSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryDocumentsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = DOCUMENTS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(DOCUMENTS_MAX_LIMIT)
  limit?: number = DOCUMENTS_DEFAULT_LIMIT;

  /** Busca por nome ou trecho da descrição. */
  @IsOptional()
  @IsString()
  @MaxLength(DOCUMENT_SEARCH_MAX_LENGTH)
  searchString?: string;

  /** Separa os documentos que ficaram sem arquivo anexado. */
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  hasMedia?: boolean;

  @IsOptional()
  @IsIn(DOCUMENT_SORT_FIELDS)
  sort?: DocumentSortField = DOCUMENT_DEFAULT_SORT;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: DocumentSortOrder = DOCUMENT_DEFAULT_ORDER;
}
