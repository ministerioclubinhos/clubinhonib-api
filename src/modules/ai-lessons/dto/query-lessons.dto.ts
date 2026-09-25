import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { LessonStatus } from '../enums/lesson.enums';

export enum LessonSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  THEME = 'theme',
  WEEK_NUMBER = 'weekNumber',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class QueryLessonsDto {
  @IsOptional() @IsEnum(LessonStatus) status?: LessonStatus;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
  @IsOptional() @IsIn(Object.values(LessonSortField)) sort: LessonSortField =
    LessonSortField.UPDATED_AT;
  @IsOptional() @IsEnum(SortOrder) order: SortOrder = SortOrder.DESC;
}
