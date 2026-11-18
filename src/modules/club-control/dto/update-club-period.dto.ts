import {
  IsString,
  IsBoolean,
  IsOptional,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class UpdateClubPeriodDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
