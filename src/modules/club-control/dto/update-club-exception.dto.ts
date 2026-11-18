import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateClubExceptionDto {
  @IsOptional()
  @IsDateString()
  exceptionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  @IsOptional()
  @IsEnum(['holiday', 'event', 'maintenance', 'vacation', 'other'])
  type?: 'holiday' | 'event' | 'maintenance' | 'vacation' | 'other';

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
