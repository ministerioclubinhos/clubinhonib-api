import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsString() street: string;
  @IsOptional() @IsString() number?: string;
  @IsString() district: string;
  @IsString() city: string;
  @IsString() state: string;
  @IsString() postalCode: string;
  @IsOptional() @IsString() complement?: string;
}

export class CreateChildDto {
  @IsString() @Length(2, 255) name: string;
  @IsDateString() birthDate: string;

  @IsString() @Length(2, 255) guardianName: string;
  @IsString() @Length(2, 255) gender: string;
  @IsString() @Length(5, 32) guardianPhone: string;

  @IsOptional() @IsDateString() joinedAt?: string;

  @IsOptional() @IsUUID() clubId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
