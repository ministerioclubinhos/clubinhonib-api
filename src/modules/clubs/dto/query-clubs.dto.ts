// src/modules/clubs/dto/query-clubs.dto.ts
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, IsString, IsIn } from 'class-validator';

export class QueryClubsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 10;

  /** Busca unificada em endereço: rua, bairro, cidade, UF, CEP */
  @IsOptional() @IsString()
  addressSearchString?: string;

  /** Busca unificada em usuários (coord/teachers): name, email, phone */
  @IsOptional() @IsString()
  userSearchString?: string;

  /**
   * Busca unificada do clube:
   * - número (>0) => club.number = N
   * - texto => casa em weekday (like)
   */
  @IsOptional() @IsString()
  clubSearchString?: string;

  /** colunas seguras para ordenação */
  @IsOptional() @IsIn(['number', 'weekday', 'createdAt', 'updatedAt', 'city', 'state'])
  sort?: 'number' | 'weekday' | 'createdAt' | 'updatedAt' | 'city' | 'state' = 'number';

  @IsOptional() @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'ASC';
}
