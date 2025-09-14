import { IsInt, IsOptional, IsString, IsBooleanString, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetUsersQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit = 12;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['user', 'admin', 'coordinator', 'teacher'])
  role?: 'user' | 'admin' | 'coordinator' | 'teacher';

  @IsOptional()
  @IsBooleanString()
  active?: string;

  @IsOptional()
  @IsBooleanString()
  completed?: string;

  @IsOptional()
  @IsIn(['name', 'email', 'phone', 'role', 'createdAt', 'updatedAt'])
  sort: string = 'updatedAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC', 'asc', 'desc'])
  order: 'ASC' | 'DESC' | 'asc' | 'desc' = 'DESC';
}
