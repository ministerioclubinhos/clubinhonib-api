// src/modules/pagelas/dto/create-pagela.dto.ts
import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePagelaDto {
  @IsUUID()
  childId: string;

  @IsOptional()
  @IsUUID()
  teacherProfileId?: string;

  @IsDateString()
  referenceDate: string; // 'YYYY-MM-DD'

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week: number; // <-- agora vem do front

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number; // <-- opcional (se não vier, calculo pelo referenceDate)

  @IsBoolean()
  present: boolean;

  @IsBoolean()
  didMeditation: boolean;

  @IsBoolean()
  recitedVerse: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
