import { IsNotEmpty, IsInt, Min, Max, IsString, IsBoolean, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';


export class CreateClubPeriodDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year: number; 

  @IsNotEmpty()
  @IsString()
  startDate: string; 

  @IsNotEmpty()
  @IsString()
  endDate: string; 

  @IsOptional()
  @IsString()
  description?: string; 

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
