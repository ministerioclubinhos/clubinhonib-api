import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
  IsUUID,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

class AddressUpdateDto {
  @IsOptional()
  @IsString()
  id?: string;

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
  @Length(1, 255)
  gender?: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @Transform(({ value }: { value: unknown }) =>
    !value || (typeof value === 'string' && value.trim() === '') ? null : value,
  )
  @IsOptional()
  @IsDateString()
  joinedAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Transform(({ value }: { value: unknown }) =>
    !value || (typeof value === 'string' && value.trim() === '') ? null : value,
  )
  @IsOptional()
  @IsUUID()
  clubId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressUpdateDto)
  address?: AddressUpdateDto | null;
}
