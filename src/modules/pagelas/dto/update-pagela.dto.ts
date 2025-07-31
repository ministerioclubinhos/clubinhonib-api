// src/modules/pagelas/dto/update-pagela.dto.ts
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePagelaDto {
  @IsOptional()
  @IsUUID()
  teacherProfileId?: string | null;

  @IsOptional()
  @IsDateString()
  referenceDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number; // <-- permitir atualizar a semana

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number; // <-- e/ou o ano

  @IsOptional()
  @IsBoolean()
  present?: boolean;

  @IsOptional()
  @IsBoolean()
  didMeditation?: boolean;

  @IsOptional()
  @IsBoolean()
  recitedVerse?: boolean;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
