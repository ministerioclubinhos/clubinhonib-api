import { IsBooleanString, IsInt, IsOptional, IsUUID, Max, Min, IsString, MaxLength } from 'class-validator';
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

  @IsOptional()
  @IsBooleanString()
  present?: 'true' | 'false';

  @IsOptional()
  @IsBooleanString()
  didMeditation?: 'true' | 'false';

  @IsOptional()
  @IsBooleanString()
  recitedVerse?: 'true' | 'false';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  searchString?: string;
}
