// src/modules/pagelas/dto/pagela-filters.dto.ts
import { IsBooleanString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PagelaFiltersDto {
  @IsOptional()
  @IsUUID()
  childId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(9999)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;

  // para filtros rápidos via querystring (?present=true)
  @IsOptional()
  @IsBooleanString()
  present?: 'true' | 'false';

  @IsOptional()
  @IsBooleanString()
  didMeditation?: 'true' | 'false';

  @IsOptional()
  @IsBooleanString()
  recitedVerse?: 'true' | 'false';
}
