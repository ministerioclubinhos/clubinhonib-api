import {
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
  IsArray,
  ArrayUnique,
  IsInt,
  Min,
  IsEnum,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

import { Weekday } from '../entities/weekday.enum';
import { CLUB_TIME_PATTERN } from '../constants';
import { ClubAddressInputDto } from './club-address.dto';

export class UpdateClubDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  number?: number;

  @IsOptional()
  @IsEnum(Weekday)
  weekday?: Weekday;

  // `null` limpa o horário; string precisa bater com o formato.
  @IsOptional()
  @ValidateIf((_, value) => typeof value === 'string')
  @Matches(CLUB_TIME_PATTERN, {
    message: 'time deve ser H:mm ou HH:mm (0:00–23:59)',
  })
  time?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // `null` desvincula o coordenador.
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  coordinatorProfileId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClubAddressInputDto)
  address?: ClubAddressInputDto;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  teacherProfileIds?: string[];
}
