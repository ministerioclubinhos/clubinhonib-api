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

class AddressDto {
  @IsOptional() @IsString() id?: string;
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() complement?: string;
}

export class CreateChildDto {
  @IsString()
  @Length(2, 255)
  name: string;

  @IsDateString()
  birthDate: string;

  @IsString()
  @Length(2, 255)
  guardianName: string;

  @IsString()
  @Length(1, 255)
  gender: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? undefined : value,
  )
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @Transform(({ value }: { value: unknown }) =>
    !value || (typeof value === 'string' && value.trim() === '')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Transform(({ value }: { value: unknown }) =>
    !value || (typeof value === 'string' && value.trim() === '')
      ? undefined
      : value,
  )
  @IsOptional()
  @IsUUID()
  clubId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}
