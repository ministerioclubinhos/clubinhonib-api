import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressUpdateDto {
  @IsOptional()
  @IsString()
  street?: string;

  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  complement?: string;

}

export class UpdateChildDto {
  @IsOptional()
  @IsString()
  @Length(2, 255)
  name?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @Length(2, 255)
  guardianName?: string;

  @IsOptional()
  @IsString()
  @Length(2, 255)
  gender?: string;

  @IsOptional()
  @IsString()
  @Length(5, 32)
  guardianPhone?: string;

  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @IsOptional()
  @IsUUID()
  clubId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressUpdateDto)
  address?: AddressUpdateDto | null;
}
