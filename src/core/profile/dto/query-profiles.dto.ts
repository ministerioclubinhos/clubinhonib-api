import { IsOptional, IsString, IsInt, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryProfilesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  @IsIn(['admin', 'teacher', 'coordinator'])
  role?: string;

  @IsOptional()
  @IsString()
  loveLanguages?: string;

  @IsOptional()
  @IsString()
  temperaments?: string;

  @IsOptional()
  @IsString()
  favoriteColor?: string;

  @IsOptional()
  @IsString()
  @IsIn(['name', 'email', 'createdAt', 'birthDate'])
  sortBy?: string = 'name';

  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'ASC';
}
