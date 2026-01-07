import { Type, Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  Min,
  IsString,
  IsIn,
  IsBoolean,
} from 'class-validator';

export class QueryClubsDto {
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
  searchString?: string;

  @Transform(({ value }: { value: string | boolean }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsIn([
    'number',
    'weekday',
    'time',
    'createdAt',
    'updatedAt',
    'city',
    'state',
  ])
  sort?:
    | 'number'
    | 'weekday'
    | 'time'
    | 'createdAt'
    | 'updatedAt'
    | 'city'
    | 'state' = 'number';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order?: 'ASC' | 'DESC' | 'asc' | 'desc' = 'ASC';
}
