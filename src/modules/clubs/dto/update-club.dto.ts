import {
  IsOptional,
  IsUUID,
  IsString,
  ValidateIf,
  ValidateNested,
  IsArray,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Weekday } from '../enums/weekday.enum/weekday.enum';

export class AddressPatchDto {
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() number?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() complement?: string;
}

export class UpdateClubDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  number?: number;

  @IsOptional() @IsEnum(Weekday)
  weekday?: Weekday;

  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  coordinatorProfileId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressPatchDto)
  address?: AddressPatchDto;
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  teacherProfileIds?: string[];
}
