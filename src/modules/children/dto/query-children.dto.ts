import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  IsNumber,
  IsBoolean,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryChildrenDto {
  @IsOptional()
  @IsString()
  searchString?: string;

  @IsOptional()
  @IsUUID()
  clubId?: string;

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsOptional()
  @IsNumber()
  clubNumber?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  birthDateFrom?: string;

  @IsOptional()
  @IsString()
  birthDateTo?: string;

  @IsOptional()
  @IsString()
  joinedAt?: string;

  @IsOptional()
  @IsString()
  joinedFrom?: string;

  @IsOptional()
  @IsString()
  joinedTo?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  orderBy?: 'name' | 'birthDate' | 'joinedAt' | 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  order?: 'ASC' | 'DESC' = 'ASC';

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}

export class QueryChildrenSimpleDto {
  @IsOptional()
  @IsString()
  searchString?: string;

  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @Transform(({ value }: { value: unknown }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  @IsOptional()
  @IsBoolean()
  acceptedChrist?: boolean;

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
