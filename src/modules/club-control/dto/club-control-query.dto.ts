import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Weekday } from 'src/modules/clubs/enums/weekday.enum/weekday.enum';

const parseStrictBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return value;
};

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class YearParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;
}

export class DateParamDto {
  @IsDateString()
  date: string;
}

export class WeekQueryDto extends PaginationQueryDto {
  @ValidateIf((query: WeekQueryDto) => query.week !== undefined)
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ValidateIf((query: WeekQueryDto) => query.year !== undefined)
  @IsDefined()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week?: number;
}

export class RequiredWeekQueryDto extends PaginationQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(53)
  week: number;
}

export class ExceptionsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class DetailedIndicatorsQueryDto extends RequiredWeekQueryDto {
  @IsOptional()
  @IsIn([
    'ok',
    'pending',
    'partial',
    'missing',
    'exception',
    'inactive',
    'out_of_period',
  ])
  status?: string;

  @IsOptional()
  @IsIn(['success', 'info', 'warning', 'critical'])
  severity?: string;

  @IsOptional()
  @IsEnum(Weekday)
  weekday?: Weekday;

  @IsOptional()
  indicatorType?: string;

  @IsOptional()
  @Transform(parseStrictBoolean)
  @IsBoolean()
  hasProblems?: boolean;
}
