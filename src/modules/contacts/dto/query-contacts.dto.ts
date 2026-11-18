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
  CONTACTS_DEFAULT_LIMIT,
  CONTACTS_DEFAULT_PAGE,
  CONTACTS_MAX_LIMIT,
  CONTACT_DEFAULT_ORDER,
  CONTACT_DEFAULT_SORT,
  CONTACT_SEARCH_MAX_LENGTH,
  CONTACT_SORT_FIELDS,
} from '../constants';
import { ContactSortField, ContactSortOrder } from '../types';

/** Converte `"true"`/`"false"` da query string em booleano. */
const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
};

export class QueryContactsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = CONTACTS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(CONTACTS_MAX_LIMIT)
  limit?: number = CONTACTS_DEFAULT_LIMIT;

  /** Busca por nome, e-mail, telefone ou trecho da mensagem. */
  @IsOptional()
  @IsString()
  @MaxLength(CONTACT_SEARCH_MAX_LENGTH)
  searchString?: string;

  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  read?: boolean;

  @IsOptional()
  @IsIn(CONTACT_SORT_FIELDS)
  sort?: ContactSortField = CONTACT_DEFAULT_SORT;

  // A ordem chega da URL em qualquer caixa; normalizar aqui evita espalhar
  // `toUpperCase()` pelo repositório.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: ContactSortOrder = CONTACT_DEFAULT_ORDER;
}
