import { IsNotEmpty, IsString, IsEnum, IsBoolean, IsOptional } from 'class-validator';


export class CreateClubExceptionDto {
  @IsNotEmpty()
  @IsString()
  exceptionDate: string; 

  @IsNotEmpty()
  @IsString()
  reason: string; 

  @IsOptional()
  @IsEnum(['holiday', 'event', 'maintenance', 'vacation', 'other'])
  type?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isRecurrent?: boolean; 
}
