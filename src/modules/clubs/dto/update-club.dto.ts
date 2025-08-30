// src/modules/clubs/dto/update-club.dto.ts
import {
  IsOptional,
  IsUUID,
  IsString,
  ValidateIf,
  ValidateNested,
  IsArray,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Weekday } from '../enums/weekday.enum/weekday.enum';

/** Patch parcial do Address */
export class AddressPatchDto {
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() complement?: string;
}

/** DTO de atualização completamente desacoplado do CreateClubDto */
export class UpdateClubDto {
  /** opcional: trocar o número do club */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  number?: number;

  /** opcional: trocar o weekday */
  @IsOptional() @IsEnum(Weekday)
  weekday?: Weekday;

  /**
   * opcional: setar/alterar coordenador.
   * Enviar `null` para DESVINCULAR o coordinator do club.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  coordinatorProfileId?: string | null;

  /** patch parcial do endereço (cria se não existir) */
  @IsOptional()
  @ValidateNested()
  @Type(() => AddressPatchDto)
  address?: AddressPatchDto;

  /**
   * opcional: sincronizar os teachers do club
   * (lista completa — cada teacher pode pertencer a um único club).
   */
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teacherProfileIds?: string[];
}
