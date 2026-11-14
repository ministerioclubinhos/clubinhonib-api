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
import { UpdateChildAddressDto } from './child-address.dto';

/**
 * Texto vazio equivale a limpar o campo.
 *
 * Na atualização, ao contrário da criação, o vazio é uma intenção: `null`
 * distingue "apague isto" de "não mexa nisto", que é a ausência da propriedade.
 */
const emptyToNull = ({ value }: { value: unknown }): unknown =>
  !value || (typeof value === 'string' && value.trim() === '') ? null : value;

export class UpdateChildDto {
  @IsOptional()
  @IsString()
  @Length(CHILD_TEXT_MIN_LENGTH, CHILD_TEXT_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @Length(CHILD_TEXT_MIN_LENGTH, CHILD_TEXT_MAX_LENGTH)
  guardianName?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && value.trim() === '' ? null : value,
  )
  @IsOptional()
  @IsString()
  guardianPhone?: string;

  @Transform(emptyToNull)
  @IsOptional()
  @IsDateString()
  joinedAt?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Transform(emptyToNull)
  @IsOptional()
  @IsUUID()
  clubId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateChildAddressDto)
  address?: UpdateChildAddressDto | null;
}
