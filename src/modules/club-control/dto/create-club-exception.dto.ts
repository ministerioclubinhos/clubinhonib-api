import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class CreateClubExceptionDto {
  @IsNotEmpty()
  @IsDateString()
  exceptionDate: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  reason: string;

  @IsOptional()
  @IsEnum(['holiday', 'event', 'maintenance', 'vacation', 'other'])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecurrent?: boolean;
}
