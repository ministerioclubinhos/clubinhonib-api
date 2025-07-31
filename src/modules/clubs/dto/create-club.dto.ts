// src/modules/clubs/dto/create-club.dto.ts
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Weekday } from '../enums/weekday.enum/weekday.enum';

class AddressInputDto {
  @IsString() street!: string;
  @IsOptional() @IsString() number?: string;
  @IsString() district!: string;
  @IsString() city!: string;
  @IsString() state!: string;
  @IsString() postalCode!: string;
  @IsOptional() @IsString() complement?: string;
}

export class CreateClubDto {
  @IsInt() @Min(1)
  number!: number;

  @IsEnum(Weekday)
  weekday!: Weekday;

  @ValidateNested()
  @Type(() => AddressInputDto)
  address!: AddressInputDto;

  /** coordenador opcional na criação */
  @IsOptional() @IsUUID()
  coordinatorProfileId?: string;
}
