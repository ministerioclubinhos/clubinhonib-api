import { IsBoolean, IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePagelaDto {
  @IsUUID()
  childId: string;

  @IsOptional()
  @IsUUID()
  teacherProfileId?: string;

  @IsDateString()
  referenceDate: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

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
