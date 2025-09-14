import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min, IsString, IsIn } from 'class-validator';

export class QueryClubsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 10;

  @IsOptional() @IsString()
  addressSearchString?: string;

  @IsOptional() @IsString()
  userSearchString?: string;

  @IsOptional() @IsString()
  clubSearchString?: string;

  @IsOptional()
  @IsIn(['number', 'weekday', 'time', 'createdAt', 'updatedAt', 'city', 'state'])
  sort?: 'number' | 'weekday' | 'time' | 'createdAt' | 'updatedAt' | 'city' | 'state' = 'number';

  @IsOptional() @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'ASC';
}
