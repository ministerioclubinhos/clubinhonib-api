import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { LogLevel } from 'src/core/observability/enums';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import { QueryLogRecordsDto } from './query-log-records.dto';

export class QueryObservabilityRecordsDto extends QueryLogRecordsDto {
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  /** Código catalogado, ex.: `INT_9001`. */
  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Z]+_\d{4}$/)
  errorCode?: string;

  @IsOptional()
  @IsEnum(LogSourceType)
  sourceType?: LogSourceType;
}
