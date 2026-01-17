import { IsOptional, IsString, IsDateString } from 'class-validator';

export class UpdatePersonalDataDto {
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  gaLeaderName?: string;

  @IsOptional()
  @IsString()
  gaLeaderContact?: string;
}
