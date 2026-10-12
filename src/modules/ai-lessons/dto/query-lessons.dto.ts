import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
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

  @IsOptional()
  @Transform(({ value }: { value: unknown }): unknown[] => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    if (Array.isArray(value)) {
      return value as unknown[];
    }
    return [value];
  })
  @IsArray()
  @IsEnum(LessonStatus, { each: true })
  statuses?: LessonStatus[];

  @IsOptional() @IsString() @MaxLength(200) search?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 10;
  @IsOptional() @IsIn(Object.values(LessonSortField)) sort: LessonSortField =
    LessonSortField.UPDATED_AT;
  @IsOptional() @IsEnum(SortOrder) order: SortOrder = SortOrder.DESC;
}
