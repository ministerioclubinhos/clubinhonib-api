import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  IsUUID,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressDto {
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() complement?: string;
}

export class CreateChildDto {
  @IsString() @Length(2, 255) name: string;
  @IsDateString() birthDate: string;

  @IsString() @Length(2, 255) guardianName: string;
  @IsString() @Length(2, 255) gender: string;
  @IsString() @Length(5, 32) guardianPhone: string;

  @IsOptional() @IsDateString() joinedAt?: string;

  @IsOptional() @IsBoolean() isActive?: boolean;

  @IsOptional() @IsUUID() clubId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
