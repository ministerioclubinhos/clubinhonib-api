// src/modules/clubs/dto/query-clubs.dto.ts
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Min,
  IsString,
  IsUUID,
  IsIn,
  IsBooleanString,
  IsEnum,
} from 'class-validator';
import { Weekday } from '../enums/weekday.enum/weekday.enum';

export class QueryClubsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 10;

  /** busca livre (endereço, coord/teacher nome/email). Para número, use `number`. */
  @IsOptional() @IsString()
  q?: string;

  /** filtro direto pelo número do club */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  number?: number;

  @IsOptional() @IsEnum(Weekday)
  weekday?: Weekday;

  // Endereço
  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  state?: string;

  @IsOptional() @IsString()
  district?: string;

  @IsOptional() @IsString()
  postalCode?: string;

  // Coordenador
  @IsOptional() @IsUUID()
  coordinatorProfileId?: string;

  @IsOptional() @IsUUID()
  coordinatorUserId?: string;

  // Teacher
  @IsOptional() @IsUUID()
  teacherProfileId?: string;

  @IsOptional() @IsUUID()
  teacherUserId?: string;

  /** true => só com coord; false => só sem coord */
  @IsOptional() @IsBooleanString()
  hasCoordinator?: string;

  /** colunas seguras para ordenação */
  @IsOptional() @IsIn(['number', 'weekday', 'createdAt', 'updatedAt', 'city', 'state'])
  sort?: 'number' | 'weekday' | 'createdAt' | 'updatedAt' | 'city' | 'state' = 'number';

  @IsOptional() @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: 'ASC'|'DESC'|'asc'|'desc' = 'ASC';
}
