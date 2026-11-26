import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

import { CHILD_TEXT_MAX_LENGTH, CHILD_TEXT_MIN_LENGTH } from '../constants';
import { Gender } from '../entities/gender.enum';
import { CreateChildAddressDto } from './child-address.dto';

/** Texto vazio equivale a campo não informado. */
const emptyToUndefined = ({ value }: { value: unknown }): unknown =>
  !value || (typeof value === 'string' && value.trim() === '')
    ? undefined
    : value;

export class CreateChildDto {
  @IsString()
  @Length(CHILD_TEXT_MIN_LENGTH, CHILD_TEXT_MAX_LENGTH)
  name: string;

  @IsDateString()
  birthDate: string;

  @IsString()
  @Length(CHILD_TEXT_MIN_LENGTH, CHILD_TEXT_MAX_LENGTH)
  guardianName: string;

  @IsEnum(Gender)
  gender: Gender;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Transform(emptyToUndefined)
  @IsOptional()
  @IsUUID()
  clubId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateChildAddressDto)
  address?: CreateChildAddressDto;
}
