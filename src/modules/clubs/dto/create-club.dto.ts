import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  ValidateNested,
  Min,
  IsArray,
  ArrayUnique,
  Matches,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

import { Weekday } from '../entities/weekday.enum';
import { CLUB_TIME_PATTERN } from '../constants';
import { ClubAddressInputDto } from './club-address.dto';

export class CreateClubDto {
  @IsInt()
  @Min(1)
  number!: number;

  @IsEnum(Weekday)
  weekday!: Weekday;

  @IsOptional()
  @Matches(CLUB_TIME_PATTERN, {
    message: 'time deve ser H:mm ou HH:mm (0:00–23:59)',
  })
  time?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClubAddressInputDto)
  address?: ClubAddressInputDto;

  @IsOptional()
  @IsUUID()
  coordinatorProfileId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  teacherProfileIds?: string[];
}
