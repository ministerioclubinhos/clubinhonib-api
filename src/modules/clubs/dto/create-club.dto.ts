import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  ValidateNested,
  IsString,
  Min,
  IsArray,
  ArrayUnique,
  Matches,
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

  @IsOptional()
  @Matches(/^([01]?\d|2[0-3]):([0-5]\d)$/, { message: 'time deve ser H:mm ou HH:mm (0:00–23:59)' })
  time?: string;

  @ValidateNested()
  @Type(() => AddressInputDto)
  address!: AddressInputDto;

  @IsOptional() @IsUUID()
  coordinatorProfileId?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID(undefined, { each: true })
  teacherProfileIds?: string[];
}
