import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { LogLevel } from 'src/core/observability/enums';
import { LogSourceType } from 'src/shared/providers/log-storage/enums';

import {
  LOG_RECORDS_ERROR_CODE_MAX_LENGTH,
  LOG_RECORDS_ERROR_CODE_PATTERN,
} from '../constants';
import { QueryLogRecordsDto } from './query-log-records.dto';

export class QueryObservabilityRecordsDto extends QueryLogRecordsDto {
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  /** Código do catálogo (`INT_9001`) ou do driver (`ER_DATA_TOO_LONG`). */
  @IsOptional()
  @IsString()
  @MaxLength(LOG_RECORDS_ERROR_CODE_MAX_LENGTH)
  @Matches(LOG_RECORDS_ERROR_CODE_PATTERN)
  errorCode?: string;

  @IsOptional()
  @IsEnum(LogSourceType)
  sourceType?: LogSourceType;
}
